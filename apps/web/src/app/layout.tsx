import type { Metadata } from "next";

import "./globals.css";
import "./ui-refresh.css";
import "./ui-shared.css";
import "./ui-mod-a.css";
import "./ui-mod-b.css";
import "./ui-mod-c.css";
import "./ui-mod-d.css";
import "./ui-mod-e.css";

export const metadata: Metadata = {
  title: "FinCrime Graph",
  description:
    "Financial crime graph intelligence and suspicious transaction investigation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
