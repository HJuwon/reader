"use client";

import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    // 일반 웹
    if (!Capacitor.isNativePlatform()) {
      await signIn("google", { callbackUrl: "/" });
      return;
    }

    // Android APK
    try {
      const result = await GoogleAuth.signIn();

      console.log("Google 로그인 결과:", result);

      const idToken = result?.authentication?.idToken;
      const accessToken = result?.authentication?.accessToken;

      if (!idToken) {
        throw new Error("Google ID Token을 받지 못했습니다.");
      }

      // NextAuth의 mobile-google Credentials Provider로 로그인
      const loginResult = await signIn("mobile-google", {
        idToken,
        accessToken: accessToken ?? "",
        redirect: false,
      });

      if (loginResult?.error) {
        throw new Error(loginResult.error);
      }

      // 로그인 성공
      window.location.href = "/";
    } catch (error) {
      console.error("Google 로그인 실패:", error);
      alert("Google 로그인에 실패했습니다.");
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
