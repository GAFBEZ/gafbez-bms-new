import { formatDate, formatTime } from "@/lib/format";

interface DateTimeCellProps {
  value: string;
}

/** Date on one line, time (muted, smaller) underneath — for table cells showing a transaction's real timestamp. */
export function DateTimeCell({ value }: DateTimeCellProps) {
  return (
    <>
      <span className="block">{formatDate(value)}</span>
      <span className="block text-xs text-gray-400 dark:text-gray-500">{formatTime(value)}</span>
    </>
  );
}
