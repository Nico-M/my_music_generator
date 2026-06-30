import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Singing Video Generator",
  description: "Create lyric videos with audio — upload, edit timeline, preview, and render",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
