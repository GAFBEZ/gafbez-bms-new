import { EmptyState } from "@/components/ui/EmptyState";
import { BonusMonthFilter } from "@/components/sales/BonusMonthFilter";
import { BonusRatesForm } from "@/components/sales/BonusRatesForm";
import { formatCurrency } from "@/lib/format";
import type { BonusCategory, BonusRates, StaffBonusSummary } from "@/types";

interface StaffBonusPanelProps {
  isAdmin: boolean;
  month: string;
  monthLabel: string;
  rates: BonusRates | null;
  summaries: StaffBonusSummary[] | null;
  dataIsLive: boolean;
}

const CATEGORY_LABELS: Record<BonusCategory, string> = {
  solar_panel: "Solar Panels",
  inverter: "Inverters",
  battery: "Batteries",
};

const CATEGORY_ORDER: BonusCategory[] = ["solar_panel", "inverter", "battery"];

export function StaffBonusPanel({ isAdmin, month, monthLabel, rates, summaries, dataIsLive }: StaffBonusPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {isAdmin
          ? "How many panels, inverters, and batteries each staff member sold this month, and the bonus that earns -- only fully paid sales count."
          : "The panels, inverters, and batteries you've sold this month, and the bonus that earns -- only fully paid sales count."}
      </p>

      {!dataIsLive && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          Bonus data isn&apos;t available right now — showing an empty view.
        </div>
      )}

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <BonusMonthFilter month={month} />
      </div>

      {rates &&
        (isAdmin ? (
          <BonusRatesForm rates={rates} />
        ) : (
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Bonus per item sold</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {CATEGORY_ORDER.map((category) => (
                <div key={category}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{CATEGORY_LABELS[category]}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(rates[category])}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Set by an Admin -- only Admin accounts can change these.</p>
          </div>
        ))}

      {!summaries || summaries.length === 0 ? (
        <EmptyState
          title="No bonus-eligible sales yet"
          description={`No fully paid sales of a bonus-tagged product (Solar Panel, Inverter, Battery) were recorded in ${monthLabel}.`}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {isAdmin && <th className="px-4 py-3">Staff</th>}
                {CATEGORY_ORDER.map((category) => (
                  <th key={category} className="px-4 py-3">
                    {CATEGORY_LABELS[category]}
                  </th>
                ))}
                <th className="px-4 py-3">Total Items</th>
                <th className="px-4 py-3">Total Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {summaries.map((summary) => (
                <tr key={summary.staffId ?? "unattributed"}>
                  {isAdmin && (
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{summary.staffName}</td>
                  )}
                  {CATEGORY_ORDER.map((category) => {
                    const entry = summary.breakdown.find((b) => b.category === category);
                    return (
                      <td key={category} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {entry ? (
                          <div className="flex flex-col">
                            <span>{entry.quantity} sold</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{formatCurrency(entry.bonus)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{summary.totalItems}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(summary.totalBonus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
