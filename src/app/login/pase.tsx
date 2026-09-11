"use client";

import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    // 일반 웹에서는 기존 NextAuth Google 로그인을 그대로 사용
    if (!Capacitor.isNativePlatform()) {
      await signIn("google", { callbackUrl: "/" });
      return;
    }

    // Android APK에서는 네이티브 Google 로그인 사용
    try {
      const user = await GoogleAuth.signIn();

      console.log("Google 로그인 성공:", user);

      // 현재는 Google 인증 결과 확인 단계
      // 다음 단계에서 이 결과를 NextAuth 세션과 연결한다.
    } catch (error) {
      console.error("Google 로그인 실패:", error);
    }
  };

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
          onClick={handleGoogleLogin}
          className="mt-8 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Google로 로그인
        </button>
      </div>
    </main>
  );
}
