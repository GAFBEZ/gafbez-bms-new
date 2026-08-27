"use client";

import { useMemo, useState, useTransition } from "react";
import { Printer, Save, Trash2 } from "lucide-react";
import type { Quote, QuoteLineItem, QuoteLoadCalc, QuoteSystemType, QuoteTemplate, SavedQuoteItem } from "@/types";
import { autoFillLoadCalcFromLineItems, computeGrandTotal, computeSubtotal } from "@/lib/quoteCalculations";
import { formatCurrency } from "@/lib/format";
import SystemTypeToggle from "./SystemTypeToggle";
import QuoteDetailsFields from "./QuoteDetailsFields";
import LineItemsTable, { type LineItemCatalogueOption } from "./LineItemsTable";
import QuoteTotals from "./QuoteTotals";
import BusinessHeader, { type QuoteBranding } from "./BusinessHeader";
import PaymentDetails from "./PaymentDetails";
import TermsWarranty from "./TermsWarranty";
import QuoteFooterContact from "./QuoteFooterContact";
import LoadCalculator from "./LoadCalculator";
import {
  deleteQuoteTemplate,
  deleteSavedItem,
  saveQuote,
  saveQuoteItem,
  saveQuoteTemplate,
  type SaveQuoteInput,
} from "@/app/dashboard/quote-builder/actions";

interface QuoteBuilderProps {
  catalogueOptions: LineItemCatalogueOption[];
  savedItems: SavedQuoteItem[];
  templates: QuoteTemplate[];
  branding: QuoteBranding & { paymentDetails: string | null; termsAndWarranty: string | null; footerDetails: string | null };
  initialQuote?: Quote | null;
}

const CARD_CLASSES = "rounded-xl border border-gray-200 bg-white p-5 print:rounded-none print:border-2 print:border-brand-green/25 print:p-4";

function emptyLoadCalc(): QuoteLoadCalc {
  return { inverterSizeKva: null, batteryCapacityKwh: null, solarArrayKw: null, appliances: [] };
}

export default function QuoteBuilder({ catalogueOptions, savedItems, templates, branding, initialQuote }: QuoteBuilderProps) {
  const [systemType, setSystemType] = useState<QuoteSystemType>(initialQuote?.systemType ?? "full_system");
  const [quoteNumber, setQuoteNumber] = useState(initialQuote?.quoteNumber ?? "");
  const [quoteDate, setQuoteDate] = useState(initialQuote?.quoteDate ?? new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState(initialQuote?.customerName ?? "");
  const [customerAddress, setCustomerAddress] = useState(initialQuote?.customerAddress ?? "");
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(initialQuote?.lineItems ?? []);
  const [vatPercent, setVatPercent] = useState(initialQuote?.vatPercent ?? 0);
  const [loadCalc, setLoadCalc] = useState<QuoteLoadCalc>(initialQuote?.loadCalc ?? emptyLoadCalc());
  const [savedId, setSavedId] = useState<string | null>(initialQuote?.id ?? null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [mySavedItems, setMySavedItems] = useState<SavedQuoteItem[]>(savedItems);
  const [myTemplates, setMyTemplates] = useState<QuoteTemplate[]>(templates);
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isPending, startTransition] = useTransition();

  const templatesForSystemType = useMemo(
    () => myTemplates.filter((template) => template.systemType === systemType),
    [myTemplates, systemType],
  );

  const bonusCategoryById = useMemo(
    () => new Map(catalogueOptions.map((product) => [product.id, product.bonusCategory])),
    [catalogueOptions],
  );

  const subtotal = useMemo(() => computeSubtotal(lineItems), [lineItems]);
  const grandTotal = useMemo(() => computeGrandTotal(subtotal, vatPercent), [subtotal, vatPercent]);

  const hasLoadCalcContent =
    loadCalc.appliances.length > 0 || Boolean(loadCalc.inverterSizeKva || loadCalc.batteryCapacityKwh || loadCalc.solarArrayKw);

  function handleAutoFill() {
    const result = autoFillLoadCalcFromLineItems(lineItems, bonusCategoryById);
    setLoadCalc((prev) => ({ ...prev, ...result }));
  }

  function handleSaveItem(item: { name: string; description: string; rate: number }) {
    const trimmedName = item.name.trim();
    if (!trimmedName) return;

    const alreadySaved = mySavedItems.some((saved) => saved.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (alreadySaved) {
      setSaveMessage(`"${trimmedName}" is already in your saved items.`);
      return;
    }

    startTransition(async () => {
      const result = await saveQuoteItem(trimmedName, item.description, item.rate);
      if ("item" in result) {
        setMySavedItems((prev) => [result.item, ...prev]);
        setSaveMessage(`"${trimmedName}" saved for future quotes.`);
      } else {
        setSaveMessage(result.error);
      }
    });
  }

  function handleDeleteSavedItem(id: string) {
    setMySavedItems((prev) => prev.filter((item) => item.id !== id));
    startTransition(async () => {
      await deleteSavedItem(id);
    });
  }

  function handleLoadTemplate(id: string) {
    const template = templatesForSystemType.find((t) => t.id === id);
    if (!template) return;

    if (lineItems.length > 0 && !window.confirm(`Replace your current items with "${template.name}"?`)) {
      return;
    }

    setLineItems(template.lineItems.map((item) => ({ ...item, id: crypto.randomUUID() })));
    setLoadCalc(
      template.loadCalc
        ? { ...template.loadCalc, appliances: template.loadCalc.appliances.map((a) => ({ ...a, id: crypto.randomUUID() })) }
        : emptyLoadCalc(),
    );
  }

  function handleSaveTemplate() {
    const trimmedName = templateName.trim();
    if (!trimmedName) return;

    const alreadySaved = myTemplates.some(
      (template) => template.systemType === systemType && template.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (alreadySaved) {
      setSaveMessage(`You already have a template named "${trimmedName}" for this system type.`);
      return;
    }

    startTransition(async () => {
      const result = await saveQuoteTemplate(trimmedName, systemType, lineItems, loadCalc);
      if ("template" in result) {
        setMyTemplates((prev) => [...prev, result.template]);
        setSaveMessage(`"${trimmedName}" saved as a template.`);
        setTemplateName("");
        setShowSaveTemplateForm(false);
      } else {
        setSaveMessage(result.error);
      }
    });
  }

  function handleDeleteTemplate(id: string) {
    setMyTemplates((prev) => prev.filter((template) => template.id !== id));
    startTransition(async () => {
      await deleteQuoteTemplate(id);
    });
  }

  function handleSave() {
    setSaveMessage(null);
    const input: SaveQuoteInput = {
      id: savedId ?? undefined,
      systemType,
      quoteNumber: quoteNumber || null,
      quoteDate,
      customerName: customerName || null,
      customerAddress: customerAddress || null,
      lineItems,
      subtotal,
      vatPercent,
      grandTotal,
      loadCalc,
    };

    startTransition(async () => {
      const result = await saveQuote(input);
      if ("error" in result) {
        setSaveMessage(result.error);
      } else {
        setSavedId(result.id);
        setSaveMessage("Quote saved.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden">
        <SystemTypeToggle value={systemType} onChange={setSystemType} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900 print:hidden">
        <label htmlFor="loadTemplate" className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Templates:
        </label>
        <select
          id="loadTemplate"
          value=""
          onChange={(e) => handleLoadTemplate(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none"
        >
          <option value="">{templatesForSystemType.length > 0 ? "Load a saved template…" : "No templates saved yet"}</option>
          {templatesForSystemType.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>

        {!showSaveTemplateForm ? (
          <button
            type="button"
            onClick={() => setShowSaveTemplateForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-brand-green transition-colors hover:bg-green-50 dark:hover:bg-gray-800"
          >
            <Save className="h-4 w-4" />
            Save current setup as template
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name, e.g. Standard 5kVA Setup"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || isPending}
              className="rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSaveTemplateForm(false);
                setTemplateName("");
              }}
              className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Cancel
            </button>
          </div>
        )}

        {myTemplates.length > 0 && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs font-semibold text-brand-green">
              Manage Templates ({myTemplates.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {myTemplates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                >
                  <span className="truncate text-gray-900 dark:text-gray-100">
                    {template.name}{" "}
                    <span className="text-gray-500 dark:text-gray-400">
                      — {template.systemType === "full_system" ? "Complete Solar System" : "Inverter & Battery Only"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(template.id)}
                    aria-label={`Delete template ${template.name}`}
                    className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className={CARD_CLASSES}>
        <BusinessHeader branding={branding} systemType={systemType} />

        <div className="my-5 print:my-2">
          <QuoteDetailsFields
            quoteNumber={quoteNumber}
            onQuoteNumberChange={setQuoteNumber}
            quoteDate={quoteDate}
            onQuoteDateChange={setQuoteDate}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerAddress={customerAddress}
            onCustomerAddressChange={setCustomerAddress}
          />
        </div>

        <LineItemsTable
          items={lineItems}
          onChange={setLineItems}
          catalogueOptions={catalogueOptions}
          savedItems={mySavedItems}
          onSaveItem={handleSaveItem}
          saving={isPending}
          systemType={systemType}
        />

        {mySavedItems.length > 0 && (
          <details className="mt-3 print:hidden">
            <summary className="cursor-pointer text-xs font-semibold text-brand-green">
              Manage Saved Items ({mySavedItems.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {mySavedItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm"
                >
                  <span className="truncate text-gray-900">
                    {item.name} <span className="text-gray-500">— {formatCurrency(item.rate)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedItem(item.id)}
                    aria-label={`Delete saved item ${item.name}`}
                    className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-5 print:mt-2">
          <QuoteTotals subtotal={subtotal} vatPercent={vatPercent} onVatPercentChange={setVatPercent} grandTotal={grandTotal} />
        </div>

        <PaymentDetails paymentDetails={branding.paymentDetails} />
      </div>

      <TermsWarranty termsAndWarranty={branding.termsAndWarranty} />

      <div className="flex flex-col">
        <LoadCalculator
          value={loadCalc}
          onChange={setLoadCalc}
          systemType={systemType}
          onAutoFill={handleAutoFill}
          branding={branding}
        />
        {/* Deliberately plain flow, not a flex/min-height "pin to page
         * bottom" trick. That approach was tried twice and failed both
         * times for different reasons -- first because grids above it were
         * silently collapsing to one column on mobile (fixed separately),
         * and then again even after that fix: on at least one mobile print
         * engine, a flex container that doesn't fit the remaining space on
         * a page moves its whole leftover child to a fresh page rather
         * than using the visible empty space left on the current one --
         * that's an engine limitation, not something margins can fix.
         * Plain flow guarantees the footer always lands on the same page
         * as the note, just not glued to the exact bottom edge. */}
        <div className={hasLoadCalcContent ? "mt-5 print:mt-6" : "mt-5"}>
          <QuoteFooterContact footerDetails={branding.footerDetails} />
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
          {isPending ? "Saving…" : "Save Quote"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-brand-green transition-colors hover:bg-green-50 dark:hover:bg-gray-800"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </button>
        {saveMessage && <span className="text-sm text-gray-500 dark:text-gray-400">{saveMessage}</span>}
      </div>
    </div>
  );
}
