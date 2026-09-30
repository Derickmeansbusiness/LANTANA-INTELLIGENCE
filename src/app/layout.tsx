import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/inter-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = localFont({
  src: [{ path: "../fonts/fraunces-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Lantana Command", template: "%s · Lantana Command" },
  description: "The operating system of Lantana Vision FZ-LLC.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141216" },
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} dark`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
