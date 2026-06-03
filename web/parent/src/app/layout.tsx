import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SVBK Parent Portal",
  description: "Sri Venkateswara Bala Kuteer – Parent Fee Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
