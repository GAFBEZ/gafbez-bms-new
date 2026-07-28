// Client-only helpers for the image uploaders (installation projects,
// products): validates a picked file and, if it's over the bucket's 5MB
// limit, re-encodes it smaller in the browser via <canvas> instead of
// just rejecting it -- staff shouldn't need to know what "compress an
// image" means before they can upload a phone photo.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function withExtension(name: string, mimeType: string): string {
  return name.replace(/\.\w+$/, "") + "." + extensionFor(mimeType);
}

async function compressImage(file: File, maxBytes: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  // PNG's quality parameter is ignored by <canvas>.toBlob -- re-encoding
  // as JPEG is the only way to actually shrink a PNG that's over the
  // limit. WebP and JPEG both compress fine as themselves.
  const outputType = file.type === "image/png" ? "image/jpeg" : file.type;

  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.9;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;

    // Flatten onto white first so transparent PNG pixels don't turn
    // black once re-encoded as JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
    if (!blob || blob.size <= maxBytes) break;

    // Quality first, then shrink dimensions once quality is already low.
    if (quality > 0.5) {
      quality -= 0.1;
    } else {
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }
  }

  bitmap.close();

  if (!blob) throw new Error("Couldn't process this image.");
  return new File([blob], withExtension(file.name, outputType), { type: outputType });
}

export async function prepareImageFile(file: File): Promise<{ file: File } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Images must be JPEG, PNG, or WebP." };
  }
  if (file.size <= MAX_IMAGE_BYTES) {
    return { file };
  }

  try {
    const compressed = await compressImage(file, MAX_IMAGE_BYTES);
    if (compressed.size > MAX_IMAGE_BYTES) {
      return { error: `"${file.name}" is too large even after compression -- try a smaller photo.` };
    }
    return { file: compressed };
  } catch {
    return { error: `Couldn't process "${file.name}". Try a different file.` };
  }
}
