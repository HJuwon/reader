import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";

export async function GET(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return Response.json(
      { error: "fileId가 필요합니다." },
      { status: 400 }
    );
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    return Response.json(
      {
        error: data.error?.message || "파일을 가져오지 못했습니다.",
      },
      { status: response.status }
    );
  }

  const content = await response.text();

  return Response.json({
    fileId,
    content,
  });
}

// ======================================================
// PUT
// 수정된 본문을 구글 드라이브 파일에 다시 저장
// ======================================================

export async function PUT(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return Response.json(
      { error: "fileId가 필요합니다." },
      { status: 400 }
    );
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "요청 본문이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { content } = body;

  if (typeof content !== "string") {
    return Response.json(
      { error: "content(문자열)가 필요합니다." },
      { status: 400 }
    );
  }

  // Google Drive의 media upload 엔드포인트로 파일 내용을 통째로 교체한다.
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: content,
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    return Response.json(
      {
        error:
          data.error?.message ||
          "파일을 저장하지 못했습니다.",
      },
      { status: response.status }
    );
  }

  const data = await response.json();

  return Response.json({
    success: true,
    fileId: data.id,
  });
}