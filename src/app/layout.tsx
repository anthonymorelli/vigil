import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ── Elan ITC Black — Arc'teryx-adjacent high-contrast serif ──────────────
// Font file lives at: app/fonts/Elan_ITC_W04_Black.ttf
// next/font/local resolves paths relative to this layout.tsx file.
const elanITC = localFont({
  src: "./fonts/Elan_ITC_W04_Black.ttf",
  weight: "900",
  style: "normal",
  variable: "--font-elan",   // referenced in globals.css @theme as --font-display
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vigil",
  description: "Sharp prop betting intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
    >
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${elanITC.variable} min-h-screen bg-background font-sans text-foreground antialiased overflow-hidden`}
      >
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}