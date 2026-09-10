import { EmptyState } from "@/components/ui/EmptyState";
import { DateTimeCell } from "@/components/ui/DateTimeCell";
import { formatCurrency } from "@/lib/format";
import type { ReturnDetail } from "@/types";

interface ReturnsTableProps {
  data: ReturnDetail[];
  /** Staff attribution is the same sensitivity level as the existing
   * admin-only "Sales by Staff" section, so that column only renders for
   * admins -- everyone else still sees product/branch/value. */
  isAdmin: boolean;
}

/** Itemized, not ranked -- unlike the Branch/Staff/Top Products charts,
 * a return is a discrete event best read as a small log (what, how much,
 * from which branch/staff) rather than a bar compared against a max. */
export function ReturnsTable({ data, isAdmin }: ReturnsTableProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No returns in this period"
        description="Nothing has been returned -- every figure above already reflects the full amount sold."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th scope="col" className="px-3 py-2 font-medium">
              Product
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Qty
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Value
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Branch
            </th>
            {isAdmin && (
              <th scope="col" className="px-3 py-2 font-medium">
                Staff
              </th>
            )}
            <th scope="col" className="px-3 py-2 font-medium">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                {row.productName}
                <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">({row.sku})</span>
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.quantity}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(row.value)}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.branchName}</td>
              {isAdmin && <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.staffName}</td>}
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                <DateTimeCell value={row.date} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
