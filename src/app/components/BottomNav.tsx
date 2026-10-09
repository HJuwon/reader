"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bookmark,
  Highlighter,
  History,
} from "lucide-react";

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
