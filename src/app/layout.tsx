import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import { getAppSettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { businessName } = await getAppSettings();
  return {
    title: `${businessName} | ${APP_NAME}`,
    description: `${APP_NAME} for ${businessName} — inventory, sales, expenses and customer management.`,
  };
}

// Runs before paint, so the correct theme applies with no flash. Reads the
// `theme` cookie directly (rather than waiting on React) since this must
// execute before hydration; kept as a plain string, not a module, because
// script tags in the App Router can't import from elsewhere.
const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var p=m?decodeURIComponent(m[1]):"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-page text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
