import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Athletik Coach",
  description: "Trainingsplan, Logging und Auswertung",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-2">
            <span className="mr-auto font-semibold">Athletik Coach</span>
            <Link href="/" className="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              Heute
            </Link>
            <Link href="/fortschritt" className="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              Fortschritt
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-32 pt-4">{children}</main>
      </body>
    </html>
  );
}
