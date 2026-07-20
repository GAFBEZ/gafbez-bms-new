import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { BranchSalesSummary } from "@/types";

interface BranchSalesChartProps {
  data: BranchSalesSummary[];
}

export function BranchSalesChart({ data }: BranchSalesChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No sales in this period"
        description="Record a sale to see branch performance here."
      />
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <ul className="flex flex-col gap-4">
      {data.map((row) => (
        <li key={row.branchId}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{row.branchName}</span>
            <span className="text-gray-500 dark:text-gray-400">{formatCurrency(row.total)}</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-brand-green"
              style={{ width: `${(row.total / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
