"use client";

import { useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { AlertCircle, ArrowDown, ArrowUp, ImageIcon, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { extensionFor, prepareImageFile } from "@/lib/imageUpload";
import { moveHeroImage, removeHeroImage, saveHeroImage } from "@/app/dashboard/settings/hero-images-actions";
import type { HeroImage } from "@/lib/heroImages";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_FILES_PER_UPLOAD = 10;
const HERO_IMAGES_BUCKET = "hero-images";

interface HeroImagesManagerProps {
  images: HeroImage[];
}

/** Homepage background photos -- a plain, caption-free list (unlike the
 * installation project gallery this replaced as the hero's source), so
 * the UI is just upload/reorder/remove, no title/location fields.
 * Uploads go straight from the browser to Supabase Storage, same as the
 * installation project and product image uploaders, and for the same
 * reason: a Server Action's request body is capped well under this
 * bucket's 5MB per-file limit on Vercel. */
export function HeroImagesManager({ images }: HeroImagesManagerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [isPendingChange, startChangeTransition] = useTransition();
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
    if (files.length > MAX_FILES_PER_UPLOAD) {
      setError(`Upload at most ${MAX_FILES_PER_UPLOAD} images at a time.`);
      return;
    }

    setError(null);
    startUploadTransition(async () => {
      const supabase = createClient();

      for (const file of files) {
        const prepared = await prepareImageFile(file);
        if ("error" in prepared) {
          setError(prepared.error);
          return;
        }
        const readyFile = prepared.file;

        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `${uniqueSuffix}.${extensionFor(readyFile.type)}`;

        const { error: uploadError } = await supabase.storage
          .from(HERO_IMAGES_BUCKET)
          .upload(path, readyFile, { contentType: readyFile.type });

        if (uploadError) {
          setError(uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage.from(HERO_IMAGES_BUCKET).getPublicUrl(path);
        const result = await saveHeroImage(publicUrlData.publicUrl);
        if (result.error) {
          setError(result.error);
          return;
        }
      }

      formRef.current?.reset();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <Image src={image.imageUrl} alt="" fill className="object-cover" sizes="160px" />
              <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={isPendingChange || index === 0}
                    onClick={() => startChangeTransition(() => moveHeroImage(image.id, "up"))}
                    aria-label="Move this photo earlier"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isPendingChange || index === images.length - 1}
                    onClick={() => startChangeTransition(() => moveHeroImage(image.id, "down"))}
                    aria-label="Move this photo later"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isPendingChange}
                  onClick={() => startChangeTransition(() => removeHeroImage(image.id, image.imageUrl))}
                  aria-label="Remove this photo"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:cursor-not-allowed"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-sm text-gray-400 dark:text-gray-500">
          <ImageIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          No background photos uploaded yet -- the homepage falls back to a
          fixed default set until at least one is added here.
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <label htmlFor={fileId} className="sr-only">
          Background photo file
        </label>
        <input
          ref={inputRef}
          id={fileId}
          name="heroImage"
          type="file"
          accept={ACCEPT}
          multiple
          required
          className="text-xs text-gray-600 dark:text-gray-400 file:mr-2 file:rounded-md file:border-0 file:bg-brand-green-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-green dark:file:text-emerald-400"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {isUploading ? "Uploading…" : "Add photos"}
        </button>
      </form>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Select multiple files to upload them all at once (up to 10), JPEG, PNG, or WebP. Large
        photos are compressed automatically. Wide, landscape photos work best -- the homepage
        shows each one in full, not cropped. Use the arrows to reorder afterward.
      </p>

      {error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
