import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      {
        ok: false,
        error: "GOOGLE_CLIENT_ID가 설정되어 있지 않습니다.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    clientId,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const idToken = body?.idToken;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "idToken이 필요합니다.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        idToken,
      )}`,
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Google ID Token 검증에 실패했습니다.",
        },
        { status: 401 },
      );
    }

    const googleUser = await response.json();

    const expectedClientId = process.env.GOOGLE_CLIENT_ID;

    if (
      expectedClientId &&
      googleUser.aud &&
      googleUser.aud !== expectedClientId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Google Client ID가 일치하지 않습니다.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
    });
  } catch (error) {
    console.error("Mobile Google Auth Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "모바일 Google 인증 처리 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}