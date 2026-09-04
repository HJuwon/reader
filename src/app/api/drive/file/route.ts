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