"use client";

import { useActionState, useId, useRef, useTransition } from "react";
import Image from "next/image";
import { AlertCircle, ArrowDown, ArrowUp, ImageIcon, Upload, X } from "lucide-react";
import {
  moveInstallationGalleryImage,
  removeInstallationGalleryImage,
  removeInstallationMainImage,
  uploadInstallationGalleryImage,
  uploadInstallationMainImage,
  type InstallationProjectFormState,
} from "@/app/dashboard/installation-projects/actions";

const initialState: InstallationProjectFormState = { error: null };
const ACCEPT = "image/jpeg,image/png,image/webp";

interface MainImageUploaderProps {
  projectId: string;
  imageUrl: string | null;
}

export function InstallationMainImageUploader({ projectId, imageUrl }: MainImageUploaderProps) {
  const uploadWithId = uploadInstallationMainImage.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(uploadWithId, initialState);
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {imageUrl ? (
            <Image src={imageUrl} alt="Main project image" width={96} height={96} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          )}
        </span>

        <div className="flex flex-col gap-2">
          <form
            ref={formRef}
            action={formAction}
            onSubmit={() => setTimeout(() => formRef.current?.reset(), 0)}
            className="flex items-center gap-2"
          >
            <label htmlFor={fileId} className="sr-only">
              Main project image file
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
                onClick={() => startRemoveTransition(() => removeInstallationMainImage(projectId))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            )}
          </form>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">JPEG, PNG, or WebP, up to 5MB. Shown as the main photo everywhere this project appears.</p>
        </div>
      </div>

      {state.error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </div>
  );
}

interface GalleryUploaderProps {
  projectId: string;
  imageUrls: string[];
}

export function InstallationGalleryUploader({ projectId, imageUrls }: GalleryUploaderProps) {
  const uploadWithId = uploadInstallationGalleryImage.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(uploadWithId, initialState);
  const [isPendingChange, startChangeTransition] = useTransition();
  const fileId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-3">
      {imageUrls.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imageUrls.map((url, index) => (
            <li key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <Image src={url} alt={`Gallery image ${index + 1}`} fill className="object-cover" sizes="120px" />
              <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={isPendingChange || index === 0}
                    onClick={() => startChangeTransition(() => moveInstallationGalleryImage(projectId, url, "up"))}
                    aria-label="Move this image earlier in the gallery"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isPendingChange || index === imageUrls.length - 1}
                    onClick={() => startChangeTransition(() => moveInstallationGalleryImage(projectId, url, "down"))}
                    aria-label="Move this image later in the gallery"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isPendingChange}
                  onClick={() => startChangeTransition(() => removeInstallationGalleryImage(projectId, url))}
                  aria-label="Remove this gallery image"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:cursor-not-allowed"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} onSubmit={() => setTimeout(() => formRef.current?.reset(), 0)} className="flex flex-wrap items-center gap-2">
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
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Add one at a time, JPEG, PNG, or WebP, up to 5MB each. Use the arrows to reorder.</p>

      {state.error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </div>
  );
}
