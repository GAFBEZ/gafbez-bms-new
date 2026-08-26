import type { ReactNode } from "react";

interface PrintValueProps {
  children: ReactNode;
  className?: string;
}

/**
 * Renders as plain text only when printing, hidden on screen -- pairs
 * with an input/select/textarea that carries `print:hidden`. A printed
 * quote should read like a finished document, not a screenshot of a
 * form: no borders, no dropdown arrows, no number spinners.
 */
export default function PrintValue({ children, className }: PrintValueProps) {
  return <span className={`hidden print:inline ${className ?? ""}`}>{children}</span>;
}
