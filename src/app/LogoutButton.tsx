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
        className="rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
      >
        로그아웃
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push("/login")}
      className="rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
    >
      Google로 로그인
    </button>
  );
}