import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Two Team Maker",
  description: "Split available players into two balanced teams and save the squad.",
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
