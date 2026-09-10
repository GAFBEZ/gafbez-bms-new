"use client";

import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { savePendingReceipt, type PendingReceiptItem } from "@/lib/pendingReceipt";

interface GenerateReceiptButtonProps {
  customerName: string;
  items: PendingReceiptItem[];
}

/** Same sessionStorage handoff SaleForm uses right after recording a new
 * sale (see src/lib/pendingReceipt.ts), triggered instead from an
 * already-recorded sale's detail page -- lets staff generate a
 * receipt/invoice for a client any time after viewing a confirmed
 * payment, not only in the moment the sale is first saved. */
export function GenerateReceiptButton({ customerName, items }: GenerateReceiptButtonProps) {
  const router = useRouter();

  function handleClick() {
    savePendingReceipt({ customerName, items });
    router.push("/dashboard/invoice-builder/new");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
    >
      <Receipt className="h-4 w-4" aria-hidden="true" />
      Generate Receipt
    </button>
  );
}
