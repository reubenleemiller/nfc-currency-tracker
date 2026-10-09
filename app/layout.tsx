import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "NFC Currency Tracker", description: "Reusable classroom reward cards" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
