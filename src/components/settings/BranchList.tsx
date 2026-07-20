import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import type { Branch } from "@/types";

interface BranchListProps {
  branches: Branch[];
}

export function BranchList({ branches }: BranchListProps) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {branches.map((branch) => (
          <li key={branch.id} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{branch.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{branch.id}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={
                  branch.status === "active"
                    ? "rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green dark:text-emerald-400"
                    : "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }
              >
                {branch.status === "active" ? "Active" : "Coming Soon"}
              </span>
              <Link
                href={`/dashboard/settings/branches/${branch.id}/edit`}
                aria-label={`Edit ${branch.name}`}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/settings/branches/new"
        className="flex w-fit items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Branch
      </Link>
    </div>
  );
}
