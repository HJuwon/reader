"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function LoginButton() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return null;
  }

  if (session) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-stone-500 ring-1 ring-stone-300 transition hover:bg-stone-100 hover:text-stone-900"
      >
        로그아웃
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push("/login")}
      className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-stone-500 ring-1 ring-stone-300 transition hover:bg-stone-100 hover:text-stone-900"
    >
      Google로 로그인
    </button>
  );
}
