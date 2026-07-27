"use client";

import { useActionState, useId, useRef, useTransition } from "react";
import Image from "next/image";
import { AlertCircle, ImageIcon, Upload, X } from "lucide-react";
import {
  removeProductGalleryImage,
  removeProductMainImage,
  uploadProductGalleryImage,
  uploadProductMainImage,
  type WebsiteDetailsFormState,
} from "@/app/dashboard/inventory/actions";

const initialState: WebsiteDetailsFormState = { error: null };
const ACCEPT = "image/jpeg,image/png,image/webp";

interface MainImageUploaderProps {
  productId: string;
  imageUrl: string | null;
}

export function MainImageUploader({ productId, imageUrl }: MainImageUploaderProps) {
  const uploadWithId = uploadProductMainImage.bind(null, productId);
  const [state, formAction, isPending] = useActionState(uploadWithId, initialState);
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileId = useId();
  const formRef = useRef<HTMLFormElement>(null);

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
          <form
            ref={formRef}
            action={formAction}
            onSubmit={() => {
              // Progress feedback: isPending already reflects the request,
              // this just avoids the browser holding the old filename in
              // the input after a successful upload.
              setTimeout(() => formRef.current?.reset(), 0);
            }}
            className="flex items-center gap-2"
          >
            <label htmlFor={fileId} className="sr-only">
              Main product image file
            </label>
            <input
              id={fileId}
              name="mainImage"
              type="file"
              accept={ACCEPT}
              required
              className="text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-brand-green-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-green dark:text-gray-400 dark:file:text-emerald-400"
            />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {isPending ? "Uploading…" : imageUrl ? "Replace" : "Upload"}
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

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </div>
  );
}

interface GalleryUploaderProps {
  productId: string;
  imageUrls: string[];
}

export function GalleryUploader({ productId, imageUrls }: GalleryUploaderProps) {
  const uploadWithId = uploadProductGalleryImage.bind(null, productId);
  const [state, formAction, isPending] = useActionState(uploadWithId, initialState);
  const [pendingRemoval, startRemoveTransition] = useTransition();
  const fileId = useId();
  const formRef = useRef<HTMLFormElement>(null);

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

      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => setTimeout(() => formRef.current?.reset(), 0)}
        className="flex flex-wrap items-center gap-2"
      >
        <label htmlFor={fileId} className="sr-only">
          Gallery image file
        </label>
        <input
          id={fileId}
          name="galleryImage"
          type="file"
          accept={ACCEPT}
          required
          className="text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-brand-green-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-green dark:text-gray-400 dark:file:text-emerald-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {isPending ? "Uploading…" : "Add to gallery"}
        </button>
      </form>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Add one at a time, JPEG, PNG, or WebP, up to 5MB each.
      </p>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </div>
  );
}
