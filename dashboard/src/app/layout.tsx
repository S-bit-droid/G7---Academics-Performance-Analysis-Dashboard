import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academic Performance Analytics Dashboard",
  description: "Group 7 academic progress dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
