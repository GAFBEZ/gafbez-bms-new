import PrintValue from "./PrintValue";

const fieldClasses =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden";
const labelClasses = "text-xs font-extrabold uppercase tracking-wide text-brand-gold";

interface QuoteDetailsFieldsProps {
  quoteNumber: string;
  onQuoteNumberChange: (value: string) => void;
  quoteDate: string;
  onQuoteDateChange: (value: string) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerAddress: string;
  onCustomerAddressChange: (value: string) => void;
}

function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export default function QuoteDetailsFields({
  quoteNumber,
  onQuoteNumberChange,
  quoteDate,
  onQuoteDateChange,
  customerName,
  onCustomerNameChange,
  customerAddress,
  onCustomerAddressChange,
}: QuoteDetailsFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:gap-1 print:text-xs">
      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="quoteNumber" className={labelClasses}>
          Quote Number
        </label>
        <input
          id="quoteNumber"
          type="text"
          value={quoteNumber}
          onChange={(e) => onQuoteNumberChange(e.target.value)}
          placeholder="e.g. GB-0231"
          className={fieldClasses}
        />
        <PrintValue className="text-black">{quoteNumber || "--"}</PrintValue>
      </div>

      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="quoteDate" className={labelClasses}>
          Quote Date
        </label>
        <input
          id="quoteDate"
          type="date"
          value={quoteDate}
          onChange={(e) => onQuoteDateChange(e.target.value)}
          className={fieldClasses}
        />
        <PrintValue className="text-black">{formatDate(quoteDate)}</PrintValue>
      </div>

      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="customerName" className={labelClasses}>
          Customer Name
        </label>
        <input
          id="customerName"
          type="text"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder="Who is this quote for?"
          className={fieldClasses}
        />
        <PrintValue className="text-black">{customerName || "--"}</PrintValue>
      </div>

      <div className="flex flex-col gap-1.5 print:gap-0">
        <label htmlFor="customerAddress" className={labelClasses}>
          Customer Address / Location
        </label>
        <input
          id="customerAddress"
          type="text"
          value={customerAddress}
          onChange={(e) => onCustomerAddressChange(e.target.value)}
          placeholder="Site location"
          className={fieldClasses}
        />
        <PrintValue className="text-black">{customerAddress || "--"}</PrintValue>
      </div>
    </div>
  );
}
