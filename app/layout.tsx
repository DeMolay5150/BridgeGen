import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionSync } from "@/components/session-sync";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BridgeGen — Private Company Decision Simulator",
  description:
    "See the systemic consequences before you make the decision.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionSync />
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
