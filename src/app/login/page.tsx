"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

let googleInitialized = false;

async function initializeGoogleSignIn() {
  if (googleInitialized) return;

  const response = await fetch("/api/mobile-auth");

  if (!response.ok) {
    throw new Error("Google Client ID를 가져오지 못했습니다.");
  }

  const data = await response.json();

  if (!data.clientId) {
    throw new Error("Google Client ID가 없습니다.");
  }

  await GoogleSignIn.initialize({
    clientId: data.clientId,
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  googleInitialized = true;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);

    try {
      // 일반 웹
      if (!Capacitor.isNativePlatform()) {
        await signIn("google", {
          callbackUrl: "/",
        });
        return;
      }

      // Android APK
      await initializeGoogleSignIn();

      const result = await GoogleSignIn.signIn();

      console.log("Google 로그인 결과:", result);

      const idToken = result.idToken;
      const accessToken = result.accessToken;

      if (!idToken) {
        throw new Error("Google ID Token을 받지 못했습니다.");
      }

      // NextAuth mobile-google Credentials Provider로 로그인
      const loginResult = await signIn("mobile-google", {
        idToken,
        accessToken: accessToken ?? "",
        redirect: false,
      });

      if (loginResult?.error) {
        throw new Error(loginResult.error);
      }

      // NextAuth 세션 생성 후 홈으로 이동
      window.location.href = "/";
    } catch (error) {
      console.error("Google 로그인 실패:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Google 로그인에 실패했습니다.";

      alert(message);
    } finally {
      setLoading(false);
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
          disabled={loading}
          className="mt-8 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "Google로 로그인"}
        </button>
      </div>
    </main>
  );
}