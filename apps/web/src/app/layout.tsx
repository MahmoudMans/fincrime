import type { Metadata } from "next";

import "./globals.css";

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
