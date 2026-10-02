import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/themes";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = {
  title: "Itinerary",
  description: "Turn tickets and confirmations into one day-by-day trip plan.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#101921" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap" />
      </head>
      <body className="min-h-dvh bg-base-200 text-base-content">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
