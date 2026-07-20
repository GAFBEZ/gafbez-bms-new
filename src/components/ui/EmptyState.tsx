import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Construction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-soft text-brand-green dark:text-emerald-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}
