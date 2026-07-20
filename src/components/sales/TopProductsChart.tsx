import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { TopProductSummary } from "@/types";

interface TopProductsChartProps {
  data: TopProductSummary[];
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No sales in this period"
        description="Record a sale to see top products here."
      />
    );
  }

  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <ul className="flex flex-col gap-4">
      {data.map((row, index) => (
        <li key={row.productId}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              <span className="mr-1.5 text-gray-400 dark:text-gray-500">{index + 1}.</span>
              {row.productName}
              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">({row.sku})</span>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {formatCurrency(row.revenue)}
              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                ({row.quantitySold.toLocaleString("en-NG")} sold)
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-brand-green"
              style={{ width: `${(row.revenue / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
