import type { Metadata } from "next";
import { APP_NAME, APP_TAGLINE, DISCLAIMER } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    "An independent AI satirical editor. Give it the thought; it finds what's wrong with it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="px-4 py-6 text-center">
          <p className="text-xs text-ink-faint">{DISCLAIMER}</p>
        </footer>
      </body>
    </html>
  );
}
