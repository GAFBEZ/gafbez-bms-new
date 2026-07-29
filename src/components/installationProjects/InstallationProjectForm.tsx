"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { InstallationProject } from "@/types";
import type { InstallationProjectFormState } from "@/app/dashboard/installation-projects/actions";
import { slugify } from "@/lib/slug";

interface InstallationProjectFormProps {
  /** Already bound to the project id for an edit form -- see
   * src/app/dashboard/installation-projects/[id]/page.tsx, which passes
   * `updateInstallationProject.bind(null, project.id)` rather than this
   * component doing the binding itself (keeps this component's action
   * prop a single, uniform useActionState-compatible signature -- same
   * pattern as ComboPackageForm/ComboPackageForm). */
  action: (prevState: InstallationProjectFormState, formData: FormData) => Promise<InstallationProjectFormState>;
  initialValues?: InstallationProject;
  submitLabel: string;
}

const initialState: InstallationProjectFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

/** Owner/Manager only in practice (create_installation_project/
 * update_installation_project both raise for anyone else via
 * can_manage_installation_projects()) -- the page rendering this form is
 * responsible for that gate, this component doesn't re-check role. */
export default function InstallationProjectForm({ action, initialValues, submitLabel }: InstallationProjectFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formId = useId();

  const [slug, setSlug] = useState(initialValues?.websiteSlug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.websiteSlug));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-title`} className={labelClasses}>
            Project Title
          </label>
          <input
            id={`${formId}-title`}
            name="title"
            required
            defaultValue={initialValues?.title}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-slug`} className={labelClasses}>
            Website Slug
          </label>
          <input
            id={`${formId}-slug`}
            name="websiteSlug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={inputClasses}
          />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Suggested automatically from the title -- edit freely. Must be unique.
          </p>
        </div>
        <div>
          <label htmlFor={`${formId}-location`} className={labelClasses}>
            Location (general area only, e.g. &quot;Garki, Abuja&quot;)
          </label>
          <input id={`${formId}-location`} name="location" defaultValue={initialValues?.location ?? ""} className={inputClasses} />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Never enter an exact private residential address here -- this is shown publicly.
          </p>
        </div>
        <div>
          <label htmlFor={`${formId}-date`} className={labelClasses}>
            Installation Date
          </label>
          <input
            id={`${formId}-date`}
            name="installationDate"
            type="date"
            defaultValue={initialValues?.installationDate ?? ""}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-capacity`} className={labelClasses}>
            System Capacity
          </label>
          <input
            id={`${formId}-capacity`}
            name="systemCapacity"
            placeholder="e.g. 8 kVA / 10 kWh"
            defaultValue={initialValues?.systemCapacity ?? ""}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-type`} className={labelClasses}>
            Project Type
          </label>
          <input
            id={`${formId}-type`}
            name="projectType"
            list={`${formId}-type-options`}
            placeholder="Residential, Commercial, Industrial…"
            defaultValue={initialValues?.projectType ?? ""}
            className={inputClasses}
          />
          <datalist id={`${formId}-type-options`}>
            <option value="Residential" />
            <option value="Commercial" />
            <option value="Industrial" />
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-short`} className={labelClasses}>
            Short Description
          </label>
          <textarea id={`${formId}-short`} name="shortDescription" rows={2} defaultValue={initialValues?.shortDescription ?? ""} className={inputClasses} />
        </div>
        <div>
          <label htmlFor={`${formId}-full`} className={labelClasses}>
            Full Description
          </label>
          <textarea id={`${formId}-full`} name="fullDescription" rows={2} defaultValue={initialValues?.fullDescription ?? ""} className={inputClasses} />
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-products`} className={labelClasses}>
          Products Used (comma-separated, free text -- e.g. brand/model names for display only)
        </label>
        <input
          id={`${formId}-products`}
          name="productsUsed"
          placeholder="Deye 8kVA Hybrid Inverter, 620W Monocrystalline Panel, LiFePO4 10kWh Battery"
          defaultValue={initialValues?.productsUsed.join(", ") ?? ""}
          className={inputClasses}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-testimonial`} className={labelClasses}>
            Customer Testimonial
          </label>
          <textarea
            id={`${formId}-testimonial`}
            name="customerTestimonial"
            rows={2}
            defaultValue={initialValues?.customerTestimonial ?? ""}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-author`} className={labelClasses}>
            Testimonial Author Name (optional)
          </label>
          <input
            id={`${formId}-author`}
            name="testimonialAuthorName"
            defaultValue={initialValues?.testimonialAuthorName ?? ""}
            className={inputClasses}
          />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Only shown publicly if filled in -- leave blank unless the customer approved being named.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="isVisibleOnWebsite" defaultChecked={initialValues?.isVisibleOnWebsite ?? false} /> Visible on Website
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="isFeatured" defaultChecked={initialValues?.isFeatured ?? false} /> Featured
        </label>
        <div>
          <label htmlFor={`${formId}-order`} className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
            Display Order
          </label>
          <input id={`${formId}-order`} name="displayOrder" type="number" min={0} defaultValue={initialValues?.displayOrder ?? 0} className={`${inputClasses} w-24`} />
        </div>
      </div>

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-60"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/dashboard/installation-projects"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
