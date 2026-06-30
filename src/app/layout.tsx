import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OfflineIndicator } from "@/components/offline-indicator";
import { Toaster } from "@/components/ui/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OSRS Services", template: "%s | OSRS Services" },
  description: "The secure OSRS Services application foundation.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <OfflineIndicator />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
