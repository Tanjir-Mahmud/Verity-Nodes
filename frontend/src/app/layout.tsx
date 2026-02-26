import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity-Nodes | Autonomous Audit War Room",
  description:
    "Multi-Agent Audit Network for the 2026 EU Green Claims Directive. Real-time autonomous supply chain compliance verification.",
  keywords: [
    "EU Green Claims Directive",
    "ESPR",
    "supply chain audit",
    "autonomous agents",
    "compliance",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
