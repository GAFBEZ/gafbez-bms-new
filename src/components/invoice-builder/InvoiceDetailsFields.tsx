import PrintValue from "@/components/quote-builder/PrintValue";

const fieldClasses =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden";
const labelClasses = "text-xs font-extrabold uppercase tracking-wide text-brand-gold";

interface InvoiceDetailsFieldsProps {
  invoiceNumber: string;
  onInvoiceNumberChange: (value: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  clientName: string;
  onClientNameChange: (value: string) => void;
  projectLocation: string;
  onProjectLocationChange: (value: string) => void;
}

function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export default function InvoiceDetailsFields({
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  clientName,
  onClientNameChange,
  projectLocation,
  onProjectLocationChange,
}: InvoiceDetailsFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-1 print:text-xs">
      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="invoiceNumber" className={labelClasses}>
          Invoice / Receipt No.
        </label>
        <input
          id="invoiceNumber"
          type="text"
          value={invoiceNumber}
          onChange={(e) => onInvoiceNumberChange(e.target.value)}
          placeholder="e.g. GB-INV-0231"
          className={fieldClasses}
        />
        <PrintValue className="text-black">{invoiceNumber || "--"}</PrintValue>
      </div>

      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="invoiceDate" className={labelClasses}>
          Date
        </label>
        <input
          id="invoiceDate"
          type="date"
          value={invoiceDate}
          onChange={(e) => onInvoiceDateChange(e.target.value)}
          className={fieldClasses}
        />
        <PrintValue className="text-black">{formatDate(invoiceDate)}</PrintValue>
      </div>

      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="clientName" className={labelClasses}>
          Client Name
        </label>
        <input
          id="clientName"
          type="text"
          value={clientName}
          onChange={(e) => onClientNameChange(e.target.value)}
          placeholder="Who is this invoice for?"
          className={fieldClasses}
        />
        <PrintValue className="text-black">{clientName || "--"}</PrintValue>
      </div>

      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="projectLocation" className={labelClasses}>
          Project Location
        </label>
        <input
          id="projectLocation"
          type="text"
          value={projectLocation}
          onChange={(e) => onProjectLocationChange(e.target.value)}
          placeholder="Site location"
          className={fieldClasses}
        />
        <PrintValue className="text-black">{projectLocation || "--"}</PrintValue>
      </div>
    </div>
  );
}
