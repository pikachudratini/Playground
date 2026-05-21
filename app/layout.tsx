import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fig — Agentic Marketing OS",
  description:
    "Build funnels that an AI agent personalizes for every individual visitor.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
