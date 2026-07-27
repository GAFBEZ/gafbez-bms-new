"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { InstallationProject } from "@/types";
import {
  deleteInstallationProject,
  toggleInstallationProjectStatus,
  updateInstallationProjectDisplayOrder,
} from "@/app/dashboard/installation-projects/actions";

interface InstallationProjectTableProps {
  projects: InstallationProject[];
  canEdit: boolean;
}

type VisibilityFilter = "all" | "visible" | "hidden";
type FeaturedFilter = "all" | "featured" | "not_featured";

function ToggleBadge({
  id,
  field,
  value,
  label,
  canEdit,
}: {
  id: string;
  field: "is_visible_on_website" | "is_featured";
  value: boolean;
  label: string;
  canEdit: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => toggleInstallationProjectStatus(id, field, value)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
        value ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      } ${canEdit ? "cursor-pointer" : "cursor-default opacity-70"}`}
    >
      {label}
    </button>
  );
}

export default function InstallationProjectTable({ projects, canEdit }: InstallationProjectTableProps) {
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [featured, setFeatured] = useState<FeaturedFilter>("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (term && !`${project.title} ${project.location ?? ""} ${project.projectType ?? ""}`.toLowerCase().includes(term)) {
        return false;
      }
      if (visibility === "visible" && !project.isVisibleOnWebsite) return false;
      if (visibility === "hidden" && project.isVisibleOnWebsite) return false;
      if (featured === "featured" && !project.isFeatured) return false;
      if (featured === "not_featured" && project.isFeatured) return false;
      return true;
    });
  }, [projects, search, visibility, featured]);

  if (projects.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No installation projects yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, location, or type…"
          aria-label="Search installation projects"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as VisibilityFilter)}
          aria-label="Filter by visibility"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="all">All visibility</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          value={featured}
          onChange={(e) => setFeatured(e.target.value as FeaturedFilter)}
          aria-label="Filter by featured status"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="all">All featured status</option>
          <option value="featured">Featured</option>
          <option value="not_featured">Not featured</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No projects match this search/filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Visible</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{project.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{project.projectType ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{project.location ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{project.systemCapacity ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ToggleBadge
                      id={project.id}
                      field="is_visible_on_website"
                      value={project.isVisibleOnWebsite}
                      label={project.isVisibleOnWebsite ? "Visible" : "Hidden"}
                      canEdit={canEdit}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ToggleBadge id={project.id} field="is_featured" value={project.isFeatured} label={project.isFeatured ? "Featured" : "—"} canEdit={canEdit} />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={project.displayOrder}
                      disabled={!canEdit}
                      aria-label={`Display order for ${project.title}`}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next) && next >= 0 && next !== project.displayOrder) {
                          updateInstallationProjectDisplayOrder(project.id, next);
                        }
                      }}
                      className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/dashboard/installation-projects/${project.id}`} className="inline-flex items-center gap-1 text-brand-green dark:text-emerald-400">
                          <Pencil className="h-4 w-4" /> Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete "${project.title}"? This cannot be undone.`)) {
                              deleteInstallationProject(project.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
