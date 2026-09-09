import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import { getQuote } from "@/lib/quotes";
import { buildQuoteBranding } from "@/lib/quoteBuilderData";
import QuoteBuilder from "@/components/quote-builder/QuoteBuilder";

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Not a page staff ever navigate to directly -- this is what
 * /api/quote-builder/pdf's headless Chromium loads (with the original
 * request's session cookie forwarded) to turn a saved quote into a PDF.
 * Mirrors the public website repo's identical print-preview page.
 * Deliberately bare: no page intro text -- everything here inherits
 * print:hidden from DashboardShell/QuoteBuilder itself anyway, but
 * there's no reason to give the renderer anything extra to load. Empty
 * catalogueOptions/savedItems/templates for the same reason: nothing on
 * the print output reads them, they only feed the on-screen dropdowns.
 */
export default async function QuoteBuilderPrintPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [quote, appSettings] = await Promise.all([getQuote(id), getAppSettings()]);
  if (!quote) notFound();

  return (
    <QuoteBuilder
      catalogueOptions={[]}
      savedItems={[]}
      templates={[]}
      branding={buildQuoteBranding(appSettings)}
      initialQuote={quote}
    />
  );
}
