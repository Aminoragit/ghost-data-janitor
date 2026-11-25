import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghost Data Janitor — hunt the ghost data haunting your database",
  description:
    "Upload a customer CSV and the Janitor finds duplicate, ghost and anomalous records, proposes a cleanup plan, and executes only what a human approves.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
