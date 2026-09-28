import { supabase } from "@/lib/supabase";

/**
 * Google refresh token을 서버(Supabase)에 저장해 두고,
 * Drive 요청 때마다 서버가 직접 access token을 발급/캐시한다.
 * → 기기(폰/태블릿)나 로그인 방식(웹/앱)과 상관없이 토큰 만료 문제가 없어진다.
 */

type CachedToken = { token: string; expiresAt: number };

const cache = new Map<string, CachedToken>();

export async function saveRefreshToken(
  email: string | null | undefined,
  refreshToken: string | null | undefined,
) {
  if (!email || !refreshToken) return;

  const { error } = await supabase.from("google_tokens").upsert({
    email,
    refresh_token: refreshToken,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("refresh token 저장 실패:", error.message);
  }

  // 새 refresh token이 들어왔으니 캐시 무효화
  cache.delete(email);
}

async function loadRefreshToken(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("google_tokens")
    .select("refresh_token")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("refresh token 조회 실패:", error.message);
    return null;
  }

  return data?.refresh_token ?? null;
}

/**
 * Drive API용 access token을 돌려준다.
 * 저장된 refresh token이 없으면 세션에 들어있는 access token으로 대체한다.
 * 반환값이 null이면 다시 로그인해야 하는 상태다.
 */
export async function getDriveAccessToken(
  session: any,
): Promise<string | null> {
  const email: string | undefined = session?.user?.email;

  if (!email) return null;

  const cached = cache.get(email);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const refreshToken = await loadRefreshToken(email);

  if (!refreshToken) {
    // 저장된 refresh token이 없음 → 세션 토큰(1시간짜리)으로 최대한 버팀
    return session?.accessToken ?? null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    // invalid_grant = refresh token 만료/폐기 → 다시 로그인 필요
    console.error("Google access token 발급 실패:", data);
    cache.delete(email);
    return null;
  }

  cache.set(email, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  });

  return data.access_token;
}
