import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Contra MRR",
  description: "See earnings and rankings for freelancers on Contra in a clean, simple table.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg text-zinc-900"
            >
              <svg
                viewBox="0 0 33 33"
                className="h-6 w-6 shrink-0"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M28,0H5C2.24,0,0,2.24,0,5v23c0,2.76,2.24,5,5,5h23c2.76,0,5-2.24,5-5V5c0-2.76-2.24-5-5-5ZM29,17c-6.63,0-12,5.37-12,12h-1c0-6.63-5.37-12-12-12v-1c6.63,0,12-5.37,12-12h1c0,6.63,5.37,12,12,12v1Z" />
              </svg>
              <span>
                Contra<span className="font-bold">MRR</span>
              </span>
            </Link>
            <Link
              href="/faq"
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
            >
              FAQ
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
