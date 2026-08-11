import { PageHeader } from "@/components/ui/PageHeader";
import { RefundsTabs } from "@/components/refunds/RefundsTabs";
import { getRefundRequests } from "@/lib/refunds";
import { getStoreCreditAccounts, getStoreCreditLedger } from "@/lib/storeCredit";
import { getCurrentUser } from "@/lib/auth";

/** Refund Requests is staff/manager-visible by route; Store Credit
 * (section 31: an Owner-only financial detail) is folded in here as an
 * admin-only tab -- see RefundsTabs. */
export default async function RefundsPage() {
  const [requests, user] = await Promise.all([getRefundRequests(), getCurrentUser()]);
  const isAdmin = user?.role === "admin";

  const [accounts, ledger] = await Promise.all([
    isAdmin ? getStoreCreditAccounts() : Promise.resolve([]),
    isAdmin ? getStoreCreditLedger() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Refund Requests" description="Review refund requests, and (Owner/Admin) manage customer store credit balances." />
      <RefundsTabs requests={requests} isAdmin={isAdmin} user={user} accounts={accounts} ledger={ledger} />
    </div>
  );
}
