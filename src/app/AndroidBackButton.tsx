"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

/**
 * 안드로이드 하드웨어/제스처 뒤로가기 버튼 처리.
 *
 * 기본 상태로는 플러그인이 없어서 뒤로가기를 누르면 앱이 그냥 종료된다.
 * - 서재(홈, "/")에서 누르면 → 앱 종료 (정상적인 안드로이드 동작)
 * - 그 외 화면에서 누르면 → 이전 화면으로 이동 (예: 소설 읽는 중 -> 서재)
 */
export default function AndroidBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: { remove: () => void } | undefined;

    import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", () => {
        if (pathname === "/") {
          App.exitApp();
          return;
        }

        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      })
    ).then((h) => {
      if (cancelled) {
        h.remove();
      } else {
        handle = h;
      }
    });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [pathname, router]);

  return null;
}
