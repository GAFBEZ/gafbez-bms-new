import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvoiceTable } from "@/components/invoice-builder/InvoiceTable";
import { getInvoices } from "@/lib/invoices";

export default async function InvoiceBuilderListPage() {
  const invoices = await getInvoices();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoice / Receipt"
        description="Saved invoices/receipts -- reopen one to log a payment as it comes in, or start a new one."
        actions={
          <Link
            href="/dashboard/invoice-builder/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Invoice / Receipt
          </Link>
        }
      />

      <InvoiceTable invoices={invoices} />
    </div>
  );
}
