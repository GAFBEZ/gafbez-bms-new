import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPendingWhatsAppOrders } from "@/lib/whatsappOrders";
import WhatsAppOrderRow from "@/components/whatsappOrders/WhatsAppOrderRow";

/** The "Continue on WhatsApp" checkout path creates an order with no
 * stock reservation and no payment -- staff agree availability/pricing
 * with the customer over WhatsApp, then Confirm here (reserves stock,
 * see confirm_whatsapp_order) or Reject. Visible to every branch's staff,
 * same audience as Daily Sales -- these are real incoming orders needing
 * prompt attention, not an admin-only financial detail. */
export default async function WhatsAppOrdersPage() {
  const orders = await getPendingWhatsAppOrders();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp Orders"
        description="Customer requests from the website's WhatsApp checkout, awaiting your confirmation once availability and payment are agreed over WhatsApp."
      />

      {orders.length === 0 ? (
        <EmptyState title="No pending WhatsApp orders" description="Requests from the website's WhatsApp checkout will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map((order) => (
                <WhatsAppOrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
