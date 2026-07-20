"use client";

import { useId, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { setActiveBranch } from "@/app/dashboard/actions";
import type { Branch } from "@/types";

interface BranchSelectorProps {
  branches: Branch[];
  activeBranchId: string;
}

/**
 * Global branch filter. Selection is persisted as a cookie (via
 * setActiveBranch) and read server-side by getActiveBranchId() so pages
 * like Customers and Stock Movement can scope their queries to it.
 */
export function BranchSelector({ branches, activeBranchId }: BranchSelectorProps) {
  const [selected, setSelected] = useState(activeBranchId);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const selectId = useId();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setSelected(value);
    startTransition(async () => {
      await setActiveBranch(value);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="sr-only">
        Branch
      </label>
      <Building2
        className="hidden h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500 sm:block"
        aria-hidden="true"
      />
      <select
        id={selectId}
        value={selected}
        onChange={handleChange}
        disabled={isPending}
        className="cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-3 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:opacity-60"
      >
        {branches.map((branch) => (
          <option
            key={branch.id}
            value={branch.id}
            disabled={branch.status === "coming-soon"}
          >
            {branch.name}
            {branch.status === "coming-soon" ? " (Coming Soon)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
