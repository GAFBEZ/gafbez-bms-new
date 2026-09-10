"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer, Save } from "lucide-react";
import type { Invoice, InvoiceLineItem, InvoicePayment, QuoteSystemType, SavedQuoteItem } from "@/types";
import type { PendingReceiptData } from "@/lib/pendingReceipt";
import type { QuoteBranding } from "@/components/quote-builder/BusinessHeader";
import type { LineItemCatalogueOption } from "@/components/quote-builder/LineItemsTable";
import SystemTypeToggle from "@/components/quote-builder/SystemTypeToggle";
import QuoteFooterContact from "@/components/quote-builder/QuoteFooterContact";
import InvoiceHeader from "./InvoiceHeader";
import InvoiceDetailsFields from "./InvoiceDetailsFields";
import InvoiceLineItems from "./InvoiceLineItems";
import InvoiceTotals from "./InvoiceTotals";
import PaymentRecordTable from "./PaymentRecordTable";
import PaymentTermsSection from "./PaymentTermsSection";
import { formatCurrency } from "@/lib/format";
import { computeAmountReceived, computeSubtotal, computeTotal } from "@/lib/invoiceCalculations";
import { createDefaultLineItems, reconcileLineItemsForSystemType } from "@/lib/invoiceLineItems";
import { buildInvoiceLineItemsFromSaleItems, peekPendingReceipt, clearPendingReceipt } from "@/lib/pendingReceipt";
import { saveInvoice, type SaveInvoiceInput } from "@/app/dashboard/invoice-builder/actions";

interface InvoiceBuilderProps {
  branding: QuoteBranding & { invoicePaymentTerms: string | null; footerDetails: string | null };
  catalogueOptions: LineItemCatalogueOption[];
  savedItems: SavedQuoteItem[];
  initialInvoice?: Invoice | null;
}

// box-decoration-break: clone makes the print border close off properly on
// every page this card lands on, instead of the default behavior where a
// box split across a page break looks like one continuous frame with an
// open bottom on page one and an open top on page two. -webkit- is still
// required for Chromium (the box-decoration-break spec's unprefixed form
// isn't implemented there even now) -- this is the engine
// api/invoice-builder/pdf's headless Chromium renders with, so it's the
// one that actually matters here. The slightly larger top padding gives a
// page that starts partway through the document (e.g. Payment Record on
// page two) a bit of breathing room under its own cloned top border,
// rather than sitting flush against it.
const CARD_CLASSES =
  "rounded-xl border border-gray-200 bg-white p-5 print:rounded-none print:border-2 print:border-brand-green/25 print:px-2 print:pb-2 print:pt-3 print:[-webkit-box-decoration-break:clone] print:[box-decoration-break:clone]";

export default function InvoiceBuilder({ branding, catalogueOptions, savedItems, initialInvoice }: InvoiceBuilderProps) {
  const router = useRouter();
  // Whether this render started from a blank form (the "new" page) rather
  // than an already-saved invoice -- captured once so it doesn't change
  // after the first save swaps in a real id, which would otherwise stop
  // the very redirect below from firing on subsequent re-saves too.
  const [isNewInvoice] = useState(!initialInvoice);
  // One-time handoff from Daily Sales' "Record Sale" form (see
  // src/lib/pendingReceipt.ts): a just-recorded walk-in sale waiting to
  // become a receipt, read once for a fresh/unsaved invoice only. A plain
  // (not lazy) read here would also fire for an already-saved invoice
  // being reopened, which should never touch this. Actually consuming it
  // (clearing storage) happens in the effect below, once mounted.
  const [pendingReceipt] = useState<PendingReceiptData | null>(() =>
    isNewInvoice ? peekPendingReceipt() : null,
  );
  const [systemType, setSystemType] = useState<QuoteSystemType>(initialInvoice?.systemType ?? "full_system");
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoice?.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initialInvoice?.invoiceDate ?? new Date().toISOString().slice(0, 10));
  const [clientName, setClientName] = useState(initialInvoice?.clientName ?? pendingReceipt?.customerName ?? "");
  const [projectLocation, setProjectLocation] = useState(initialInvoice?.projectLocation ?? "");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    initialInvoice?.lineItems ??
      (pendingReceipt && pendingReceipt.items.length > 0
        ? buildInvoiceLineItemsFromSaleItems(pendingReceipt.items, systemType)
        : createDefaultLineItems(systemType)),
  );
  const [vatPercent, setVatPercent] = useState(initialInvoice?.vatPercent ?? 0);
  const [depositPercent, setDepositPercent] = useState(initialInvoice?.depositPercent ?? 70);
  const [payments, setPayments] = useState<InvoicePayment[]>(initialInvoice?.payments ?? []);
  const [savedId, setSavedId] = useState<string | null>(initialInvoice?.id ?? null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Consumes the pending receipt (if any) so revisiting/refreshing this
  // page doesn't re-apply it -- a real external-system side effect, not
  // a state sync, so it doesn't call setState.
  useEffect(() => {
    if (pendingReceipt) clearPendingReceipt();
  }, [pendingReceipt]);

  const subtotal = useMemo(() => computeSubtotal(lineItems), [lineItems]);
  const total = useMemo(() => computeTotal(subtotal, vatPercent), [subtotal, vatPercent]);
  const amountReceived = useMemo(() => computeAmountReceived(payments), [payments]);

  function handleSystemTypeChange(value: QuoteSystemType) {
    setSystemType(value);
    setLineItems((prev) => reconcileLineItemsForSystemType(prev, value));
  }

  function buildSaveInput(): SaveInvoiceInput {
    return {
      id: savedId ?? undefined,
      systemType,
      invoiceNumber: invoiceNumber || null,
      invoiceDate,
      clientName: clientName || null,
      projectLocation: projectLocation || null,
      lineItems,
      subtotal,
      vatPercent,
      total,
      depositPercent,
      payments,
    };
  }

  function handleSave() {
    setSaveMessage(null);
    startTransition(async () => {
      const result = await saveInvoice(buildSaveInput());
      if ("error" in result) {
        setSaveMessage(result.error);
      } else {
        setSavedId(result.id);
        setSaveMessage("Invoice saved.");
        // First save from a blank form: move to this invoice's own
        // bookmarkable edit URL so it can be found again later from the
        // Invoice / Receipt list, instead of staying on the "new" page
        // with the saved row only reachable via in-memory state.
        if (isNewInvoice) {
          router.replace(`/dashboard/invoice-builder/${result.id}`);
        }
      }
    });
  }

  /** The PDF is rendered server-side from a saved invoice row (see
   * /api/invoice-builder/pdf), not from whatever's currently unsaved in
   * this form -- so this saves first (identical to "Save"), then
   * navigates to the PDF route to trigger the download. */
  function handleDownloadPdf() {
    setSaveMessage(null);
    setIsPreparingPdf(true);
    startTransition(async () => {
      const result = await saveInvoice(buildSaveInput());
      if ("error" in result) {
        setSaveMessage(result.error);
        setIsPreparingPdf(false);
        return;
      }
      setSavedId(result.id);
      if (isNewInvoice) {
        router.replace(`/dashboard/invoice-builder/${result.id}`);
      }
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/api/invoice-builder/pdf?id=${result.id}`;
      setIsPreparingPdf(false);
    });
  }

  return (
    <div className="flex flex-col gap-5 print:block">
      <div className="print:hidden">
        <SystemTypeToggle value={systemType} onChange={handleSystemTypeChange} />
      </div>

      <div className={CARD_CLASSES}>
        <InvoiceHeader branding={branding} />

        <div className="my-4 print:my-0.5">
          <InvoiceDetailsFields
            invoiceNumber={invoiceNumber}
            onInvoiceNumberChange={setInvoiceNumber}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={setInvoiceDate}
            clientName={clientName}
            onClientNameChange={setClientName}
            projectLocation={projectLocation}
            onProjectLocationChange={setProjectLocation}
          />
        </div>

        <InvoiceLineItems
          items={lineItems}
          onChange={setLineItems}
          catalogueOptions={catalogueOptions}
          savedItems={savedItems}
          systemType={systemType}
        />

        <div className="mt-4 print:mt-0.5">
          <InvoiceTotals
            subtotal={subtotal}
            vatPercent={vatPercent}
            onVatPercentChange={setVatPercent}
            total={total}
            depositPercent={depositPercent}
            onDepositPercentChange={setDepositPercent}
          />
        </div>

        {/* Payment Record through the footer is one avoid-page-break unit
            rather than several small ones -- a dense invoice (many line
            items with long descriptions) can still run past one page, and
            when it does, this makes the whole thing move to page two
            together instead of splitting awkwardly partway through (e.g.
            Payment Terms staying on page one while just the signature
            block and footer spill onto an otherwise-empty page two). */}
        <div className="mt-4 avoid-page-break print:mt-1">
          <div>
            <p className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-brand-green print:mb-0.5 print:text-xs">
              Payment Record
            </p>
            <PaymentRecordTable payments={payments} onChange={setPayments} />
          </div>

          <p className="mt-3 text-xs text-black print:mt-1">
            <span className="font-bold">Receipt Confirmation: </span>
            This document confirms receipt of <span className="font-semibold">{formatCurrency(amountReceived)}</span> from
            the client as payment toward the above solar installation project.
          </p>

          <div className="mt-4 print:mt-1">
            <PaymentTermsSection paymentTerms={branding.invoicePaymentTerms} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-6 text-xs text-black print:mt-1.5 print:gap-4">
            <div>
              <p className="border-t border-black pt-1 font-semibold">For {branding.businessName}</p>
              <p className="mt-2 print:mt-1">Signature: ______________________</p>
              <p className="mt-1.5 print:mt-1">Name: ______________________</p>
              <p className="mt-1.5 print:mt-1">Date: ______________________</p>
            </div>
            <div>
              <p className="border-t border-black pt-1 font-semibold">Client Acceptance</p>
              <p className="mt-2 print:mt-1">Signature: ______________________</p>
              <p className="mt-1.5 print:mt-1">Name: ______________________</p>
              <p className="mt-1.5 print:mt-1">Date: ______________________</p>
            </div>
          </div>

          <div className="mt-4 print:mt-1">
            <QuoteFooterContact footerDetails={branding.footerDetails} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save Invoice"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {isPreparingPdf ? "Preparing PDF…" : "Download PDF (Mobile)"}
        </button>
        {saveMessage && <span className="text-sm text-gray-500 dark:text-gray-400">{saveMessage}</span>}
      </div>
    </div>
  );
}
