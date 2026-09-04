import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,

      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.readonly",

          // Google refresh_token을 받기 위해 사용
          access_type: "offline",

          // 기존에 권한을 승인했더라도 다시 refresh_token을 받을 수 있도록 함
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }: any) {
      // =====================================================
      // 최초 Google 로그인
      // =====================================================

      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires =
          Date.now() +
          (account.expires_in ?? 3600) * 1000;

        return token;
      }

      // =====================================================
      // access token이 아직 유효하면 그대로 사용
      // =====================================================

      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() <
          token.accessTokenExpires - 60 * 1000
      ) {
        return token;
      }

      // =====================================================
      // access token 만료 → refresh token으로 갱신
      // =====================================================

      if (!token.refreshToken) {
        console.error(
          "Google refresh token이 없습니다."
        );

        return token;
      }

      try {
        const response = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id:
                process.env.GOOGLE_CLIENT_ID!,
              client_secret:
                process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token:
                token.refreshToken,
            }),
          }
        );

        const refreshedTokens =
          await response.json();

        if (!response.ok) {
          throw refreshedTokens;
        }

        token.accessToken =
          refreshedTokens.access_token;

        token.accessTokenExpires =
          Date.now() +
          (refreshedTokens.expires_in ?? 3600) *
            1000;

        // Google이 새 refresh_token을 주는 경우에만 교체
        if (refreshedTokens.refresh_token) {
          token.refreshToken =
            refreshedTokens.refresh_token;
        }

        return token;
      } catch (error) {
        console.error(
          "Google access token 갱신 실패:",
          error
        );

        return token;
      }
    },

    async session({ session, token }: any) {
      session.accessToken = token.accessToken;

      return session;
    },
  },
};

export default NextAuth(authOptions);