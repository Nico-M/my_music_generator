import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { AiSettingsProvider } from "@/components/AiSettingsProvider";
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
    <html lang="zh-CN" data-lang="zh" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <LanguageProvider><AiSettingsProvider>{children}</AiSettingsProvider></LanguageProvider>
      </body>
    </html>
  );
}
