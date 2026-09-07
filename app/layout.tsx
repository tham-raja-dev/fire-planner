import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FI Free — Retirement Planner Prototype",
  description: "Explore when work can become optional and build a practical FIRE plan.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
