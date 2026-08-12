import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWhatsAppOrders } from "@/lib/whatsappOrders";
import WhatsAppOrderRow from "@/components/whatsappOrders/WhatsAppOrderRow";

/** The "Continue on WhatsApp" checkout path creates an order with no
 * stock reservation and no payment -- staff agree availability/pricing
 * with the customer over WhatsApp, then Confirm here (reserves stock,
 * see confirm_whatsapp_order) or Reject, then Mark as Paid once the
 * customer actually pays and picks up (see mark_whatsapp_order_paid).
 * Every WhatsApp order stays visible here regardless of status -- this is
 * the full log, not just the pending queue. Visible to every branch's
 * staff, same audience as Daily Sales. */
export default async function WhatsAppOrdersPage() {
  const orders = await getWhatsAppOrders();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp Orders"
        description="Every request from the website's WhatsApp checkout. Confirm or reject a new request, then mark it paid once the customer pays and picks up."
      />

      {orders.length === 0 ? (
        <EmptyState title="No WhatsApp orders yet" description="Requests from the website's WhatsApp checkout will appear here." />
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
                <th className="px-4 py-3">Status</th>
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
