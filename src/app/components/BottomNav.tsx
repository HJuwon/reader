"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bookmark, Highlighter, History } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  // The reader page renders its own floating control capsule for an
  // immersive full-screen experience — the global nav must not double up.
  if (pathname.startsWith("/drive") || pathname.startsWith("/reader")) {
    return null;
  }

  const menus = [
    {
      label: "서재",
      href: "/",
      icon: BookOpen,
    },
    {
      label: "북마크",
      href: "/bookmarks",
      icon: Bookmark,
    },
    {
      label: "하이라이트",
      href: "/highlights",
      icon: Highlighter,
    },
    {
      label: "읽기 이력",
      href: "/history",
      icon: History,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-sky-200/70 bg-[#eaf6fd]/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-2.5 sm:py-3">
        {menus.map((menu) => {
          const Icon = menu.icon;

          const active =
            menu.href === "/"
              ? pathname === "/"
              : pathname.startsWith(menu.href);

          return (
            <Link
              key={menu.href}
              href={menu.href}
              className={`flex flex-col items-center gap-1 text-xs transition sm:text-sm ${
                active
                  ? "font-semibold text-[#0284c7]"
                  : "text-slate-400 hover:text-slate-900"
              }`}
            >
              <Icon
                className="h-4 w-4 sm:h-5 sm:w-5"
                strokeWidth={active ? 2 : 1.75}
              />

              <span>{menu.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
