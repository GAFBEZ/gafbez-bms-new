import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import type { Quote } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import { getQuote } from "@/lib/quotes";
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
 * @sparticuz/chromium ships a Linux binary built for AWS Lambda's runtime
 * (what Vercel's Node functions run on) -- it doesn't run on macOS, so
 * local dev falls back to the full `puppeteer` package (a devDependency
 * only), which downloads its own local Chromium at install time. Both
 * packages' `launch()` resolve to the same underlying puppeteer-core
 * `Browser` type, so the rest of this route doesn't need to know which
 * branch ran. Mirrors the public website repo's identical PDF route.
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteer }, path, fs] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
      import("node:path"),
      import("node:fs"),
    ]);

    // Next's dependency trace doesn't always place this binary where
    // chromium.executablePath()'s own no-arg lookup expects it -- point it
    // at the path outputFileTracingIncludes (next.config.ts) puts it at
    // when present, and fall back to the package's own default lookup
    // otherwise (e.g. if a future @sparticuz/chromium release changes its
    // layout).
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
    .replace(/[^\x20-\x7E]/g, "") // non-ASCII would break the Content-Disposition header value
    .replace(/["\\/]/g, "") // quotes/backslashes/slashes would break the header quoting or look like a path
    .replace(/\s+/g, " ")
    .trim();
}

/** "Quote - <customer or quote number or id> - <date>.pdf" -- readable
 * enough that staff don't need to rename it themselves after
 * downloading. Falls back down the chain since customerName is often
 * left blank on a test/in-progress quote. */
function buildFilename(quote: Quote): string {
  const label =
    sanitizeForFilename(quote.customerName ?? "") || sanitizeForFilename(quote.quoteNumber ?? "") || quote.id;
  return `Quote - ${label} - ${formatDate(quote.quoteDate)}.pdf`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing quote id." }, { status: 400 });
  }

  const quote = await getQuote(id);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || (await getAppOrigin());
  const previewUrl = `${origin}/dashboard/quote-builder/${id}/print-preview`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Lets Chromium load the preview page as the same logged-in staff
    // member making this request -- no signed link or second login, just
    // the real session cookie carried over from the original request.
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ Cookie: cookieHeader });
    }

    await page.goto(previewUrl, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");

    // preferCSSPageSize: true means globals.css's `@page { size: A4;
    // margin: 12mm; }` is the single source of truth for page size/
    // margins -- nothing is duplicated or re-specified here.
    const pdfBuffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    // .buffer alone could include unrelated data if this is a view into a
    // larger underlying buffer -- slice to this view's own bytes so
    // NextResponse gets a clean ArrayBuffer (Uint8Array's generic
    // ArrayBufferLike type isn't directly assignable to BodyInit).
    const pdfArrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ) as ArrayBuffer;

    return new NextResponse(pdfArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildFilename(quote)}"`,
      },
    });
  } catch (error) {
    console.error("[quote-builder] PDF generation failed:", error);
    return NextResponse.json({ error: "Couldn't generate the PDF. Please try again." }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
