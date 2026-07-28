"use client";

import { useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { AlertCircle, ImageIcon, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addProductGalleryImageUrls,
  removeProductGalleryImage,
  removeProductMainImage,
  saveProductMainImageUrl,
} from "@/app/dashboard/inventory/actions";

const ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGES_BUCKET = "product-images";

// Uploaded straight from the browser to Supabase Storage rather than
// through a Server Action -- a Server Action's request body is proxied
// through Vercel's serverless function pipeline, which hard-caps request
// bodies at 4.5MB no matter what Next.js is configured to allow, well
// under this bucket's own 5MB per-file limit. Uploading client-side
// bypasses that ceiling entirely; only the resulting URL goes through a
// Server Action afterward, to persist it on the product's website details.

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Images must be JPEG, PNG, or WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 5MB or smaller.";
  return null;
}

interface MainImageUploaderProps {
  productId: string;
  imageUrl: string | null;
}

export function MainImageUploader({ productId, imageUrl }: MainImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose an image file to upload.");
      return;
    }
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    startUploadTransition(async () => {
      const supabase = createClient();
      // Fixed path per product (upsert), same technique as the branding
      // logo (0020_logo_upload.sql) -- replacing the main image never
      // leaves an orphaned old file behind under a different extension.
      const path = `${productId}/main.${extensionFor(file)}`;

      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
      const result = await saveProductMainImageUrl(productId, publicUrlData.publicUrl);

      if (result.error) {
        setError(result.error);
        return;
      }

      formRef.current?.reset();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="Main product image"
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          )}
        </span>

        <div className="flex flex-col gap-2">
          <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-2">
            <label htmlFor={fileId} className="sr-only">
              Main product image file
            </label>
            <input
              ref={inputRef}
              id={fileId}
              name="mainImage"
              type="file"
              accept={ACCEPT}
              required
              className="text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-brand-green-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-green dark:text-gray-400 dark:file:text-emerald-400"
            />
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {isUploading ? "Uploading…" : imageUrl ? "Replace" : "Upload"}
            </button>
            {imageUrl && (
              <button
                type="button"
                disabled={isRemoving}
                onClick={() => startRemoveTransition(() => removeProductMainImage(productId))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            )}
          </form>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            JPEG, PNG, or WebP, up to 5MB. Shown as the main photo on the product page.
          </p>
        </div>
      </div>

      {error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

interface GalleryUploaderProps {
  productId: string;
  imageUrls: string[];
}

const MAX_GALLERY_FILES_PER_UPLOAD = 10;

export function GalleryUploader({ productId, imageUrls }: GalleryUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [pendingRemoval, startRemoveTransition] = useTransition();
  const fileId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = Array.from(inputRef.current?.files ?? []);

    if (files.length === 0) {
      setError("Choose at least one image file to upload.");
      return;
    }
    if (files.length > MAX_GALLERY_FILES_PER_UPLOAD) {
      setError(`Upload at most ${MAX_GALLERY_FILES_PER_UPLOAD} images at a time.`);
      return;
    }
    for (const file of files) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError(null);
    startUploadTransition(async () => {
      const supabase = createClient();
      const uploadedUrls: string[] = [];

      for (const file of files) {
        // Unique filename per gallery upload (timestamp + random suffix),
        // unlike the main image's fixed path -- a product can have many
        // gallery images at once, so each needs its own object.
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `${productId}/gallery/${uniqueSuffix}.${extensionFor(file)}`;

        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(path, file, { contentType: file.type });

        if (uploadError) {
          setError(uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      const result = await addProductGalleryImageUrls(productId, uploadedUrls);
      if (result.error) {
        setError(result.error);
        return;
      }

      formRef.current?.reset();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {imageUrls.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imageUrls.map((url) => (
            <li key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <Image src={url} alt="Gallery image" fill className="object-cover" sizes="120px" />
              <button
                type="button"
                disabled={pendingRemoval}
                onClick={() => startRemoveTransition(() => removeProductGalleryImage(productId, url))}
                aria-label="Remove this gallery image"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <label htmlFor={fileId} className="sr-only">
          Gallery image file
        </label>
        <input
          ref={inputRef}
          id={fileId}
          name="galleryImage"
          type="file"
          accept={ACCEPT}
          multiple
          required
          className="text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-brand-green-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-green dark:text-gray-400 dark:file:text-emerald-400"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {isUploading ? "Uploading…" : "Add to gallery"}
        </button>
      </form>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Select multiple files to upload them all at once (up to 10), JPEG, PNG, or WebP, up to 5MB each.
      </p>

      {error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
