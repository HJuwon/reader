import NextAuth, { type AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: AuthOptions = {
  providers: [
    // 웹 브라우저용 Google 로그인
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),

    // Android APK용 네이티브 Google 로그인
    CredentialsProvider({
      id: "mobile-google",
      name: "Mobile Google",

      credentials: {
        idToken: {
          label: "Google ID Token",
          type: "text",
        },
        accessToken: {
          label: "Google Access Token",
          type: "text",
        },
        serverAuthCode: {
          label: "Google Server Auth Code",
          type: "text",
        },
      },

      async authorize(credentials) {
        if (!credentials?.idToken) {
          return null;
        }

        try {
          // Android에서 받은 Google ID Token 검증
          const response = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
              credentials.idToken,
            )}`,
          );

          if (!response.ok) {
            console.error("Google ID Token 검증 실패");
            return null;
          }

          const googleUser = await response.json();

          // 우리 서비스에서 사용하는 Web Client ID인지 확인
          if (
            process.env.GOOGLE_CLIENT_ID &&
            googleUser.aud !== process.env.GOOGLE_CLIENT_ID
          ) {
            console.error("Google Client ID 불일치");
            return null;
          }

          if (!googleUser.sub || !googleUser.email) {
            console.error("Google 사용자 정보 부족");
            return null;
          }

          let accessToken = credentials.accessToken ?? null;
          let refreshToken: string | null = null;
          let expiresIn = 3600;

          // serverAuthCode가 있으면 진짜 access/refresh token으로 교환
          if (credentials.serverAuthCode) {
            const tokenRes = await fetch(
              "https://oauth2.googleapis.com/token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  client_id: process.env.GOOGLE_CLIENT_ID!,
                  client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                  code: credentials.serverAuthCode,
                  grant_type: "authorization_code",
                }),
              },
            );

            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              accessToken = tokenData.access_token ?? accessToken;
              refreshToken = tokenData.refresh_token ?? null;
              expiresIn = tokenData.expires_in ?? 3600;
            } else {
              console.error(
                "서버 인증 코드 교환 실패:",
                await tokenRes.text(),
              );
            }
          }

          return {
            id: googleUser.sub,
            name: googleUser.name ?? null,
            email: googleUser.email,
            image: googleUser.picture ?? null,
            accessToken,
            refreshToken,
            expiresIn,
          };
        } catch (error) {
          console.error("Mobile Google 로그인 실패:", error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, account, user }: any) {
      // --------------------------------
      // 1. 웹 Google 로그인
      // --------------------------------
      if (account?.provider === "google") {
        token.accessToken = account.access_token;

        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }

        token.accessTokenExpires =
          Date.now() + (account.expires_in ?? 3600) * 1000;

        return token;
      }

      // --------------------------------
      // 2. Android 네이티브 Google 로그인
      // --------------------------------
      if (account?.provider === "mobile-google") {
        token.accessToken = user?.accessToken ?? null;

        if (user?.refreshToken) {
          token.refreshToken = user.refreshToken;
        }

        token.accessTokenExpires =
          Date.now() + (user?.expiresIn ?? 3600) * 1000;

        return token;
      }

      // --------------------------------
      // 3. Access Token이 아직 유효한 경우
      // --------------------------------
      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60 * 1000
      ) {
        return token;
      }

      // --------------------------------
      // 4. Refresh Token이 없는 경우
      // --------------------------------
      if (!token.refreshToken) {
        return token;
      }

      // --------------------------------
      // 5. Google Access Token 갱신 (웹/앱 공통)
      // --------------------------------
      try {
        const response = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken,
            }),
          },
        );

        const refreshedTokens = await response.json();

        if (!response.ok) {
          throw refreshedTokens;
        }

        token.accessToken = refreshedTokens.access_token;

        token.accessTokenExpires =
          Date.now() +
          (refreshedTokens.expires_in ?? 3600) * 1000;

        if (refreshedTokens.refresh_token) {
          token.refreshToken = refreshedTokens.refresh_token;
        }

        return token;
      } catch (error) {
        console.error("Google access token 갱신 실패:", error);
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
