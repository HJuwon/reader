import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export default function SubPageLayout({
  title,
  count,
  headerRight,
  children,
}: {
  title: string;
  count?: number;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper text-slate-900">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            서재
          </Link>

          {headerRight}
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="flex items-end gap-2.5">
          <h1 className="font-serif text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">
            {title}
          </h1>

          {count !== undefined && (
            <span className="pb-1 text-sm text-slate-400">
              {count.toLocaleString("ko-KR")}
            </span>
          )}
        </div>

        {children}
      </section>
    </main>
  );
}
