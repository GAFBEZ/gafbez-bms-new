import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import type { Invoice } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import { getInvoice } from "@/lib/invoices";
import { formatDate } from "@/lib/format";
import { getAppOrigin } from "@/lib/site";

// Puppeteer/Chromium needs a real Node.js process (filesystem access to the
// browser binary) -- the Edge runtime can't run this at all.
export const runtime = "nodejs";
// Chromium cold-start + navigation + render typically takes a few seconds.
// Revisit once deployed -- allowed function duration depends on the
// Vercel plan/settings in place, which can't be checked from here.
export const maxDuration = 60;

/**
 * Same Chromium launch strategy as the Quote Builder's identical PDF
 * route (src/app/api/quote-builder/pdf/route.ts) -- see that file's
 * comments for the full explanation of the prod/dev split.
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteer }, path, fs] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
      import("node:path"),
      import("node:fs"),
    ]);

    const bundledBinDir = path.join(process.cwd(), "node_modules/@sparticuz/chromium/bin");
    const executablePath = await chromium.executablePath(fs.existsSync(bundledBinDir) ? bundledBinDir : undefined);

    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({ headless: true }) as unknown as Promise<Browser>;
}

function sanitizeForFilename(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFilename(invoice: Invoice): string {
  const label =
    sanitizeForFilename(invoice.clientName ?? "") || sanitizeForFilename(invoice.invoiceNumber ?? "") || invoice.id;
  return `Invoice - ${label} - ${formatDate(invoice.invoiceDate)}.pdf`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing invoice id." }, { status: 400 });
  }

  const invoice = await getInvoice(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || (await getAppOrigin());
  const previewUrl = `${origin}/dashboard/invoice-builder/${id}/print-preview`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ Cookie: cookieHeader });
    }

    await page.goto(previewUrl, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const pdfArrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ) as ArrayBuffer;

    return new NextResponse(pdfArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildFilename(invoice)}"`,
      },
    });
  } catch (error) {
    console.error("[invoice-builder] PDF generation failed:", error);
    return NextResponse.json({ error: "Couldn't generate the PDF. Please try again." }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
