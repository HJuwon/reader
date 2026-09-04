"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          Reader
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          로그인하면 내 서재를 이용할 수 있습니다.
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="mt-8 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Google로 로그인
        </button>
      </div>
    </main>
  );
}