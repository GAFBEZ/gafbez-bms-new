import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { ExpenseCategorySummary } from "@/types";

interface ExpenseCategoryChartProps {
  data: ExpenseCategorySummary[];
}

export function ExpenseCategoryChart({ data }: ExpenseCategoryChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No expenses recorded yet"
        description="Add an expense to see the category breakdown here."
      />
    );
  }

  const total = data.reduce((sum, row) => sum + row.total, 0);
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <ul className="flex flex-col gap-4">
      {data.map((row) => {
        const percent = total > 0 ? (row.total / total) * 100 : 0;
        return (
          <li key={row.category}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{row.category}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatCurrency(row.total)}
                <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                  ({percent.toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-brand-green"
                style={{ width: `${(row.total / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
