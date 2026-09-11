import NextAuth, { type AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,

      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, account }: any) {
      if (account) {
        token.accessToken = account.access_token;

        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }

        token.accessTokenExpires =
          Date.now() + (account.expires_in ?? 3600) * 1000;

        return token;
      }

      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60 * 1000
      ) {
        return token;
      }

      if (!token.refreshToken) {
        console.error("Google refresh token이 없습니다.");
        return token;
      }

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
          }
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
