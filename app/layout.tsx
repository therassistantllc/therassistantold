// File: app/layout.tsx
import type { Metadata } from "next";
import EhrTopNav from "@/components/layout/EhrTopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "THERASSISTANT EHR",
  description: "Clinician-first EHR and revenue cycle workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <EhrTopNav />
        {children}
      </body>
    </html>
  );
}
