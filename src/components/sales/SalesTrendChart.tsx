import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { SalesTrendPoint } from "@/types";

interface SalesTrendChartProps {
  data: SalesTrendPoint[];
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const hasSales = data.some((point) => point.total > 0);

  if (!hasSales) {
    return (
      <EmptyState
        title="No sales in this period"
        description="Record a sale to see the daily trend here."
      />
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);
  // Cap the number of visible date labels so a 90-day range doesn't crowd out.
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="overflow-x-auto">
      <div
        className="flex items-end gap-1.5"
        style={{ minWidth: `${data.length * 20}px`, height: "160px" }}
      >
        {data.map((point, index) => (
          <div
            key={point.date}
            className="flex flex-1 flex-col items-center justify-end gap-1.5"
            title={`${formatDayLabel(point.date)}: ${formatCurrency(point.total)}`}
          >
            <div
              className="w-full max-w-4 rounded-t bg-brand-green"
              style={{ height: `${Math.max((point.total / max) * 130, point.total > 0 ? 2 : 0)}px` }}
            />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {index % labelStep === 0 ? formatDayLabel(point.date) : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
