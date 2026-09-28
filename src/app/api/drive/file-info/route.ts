import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { getDriveAccessToken } from "@/lib/googleToken";

export async function GET(request: Request) {
  const session: any = await getServerSession(authOptions);

  const accessToken = await getDriveAccessToken(session);

  if (!accessToken) {
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
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?fields=id,name,mimeType,modifiedTime,size`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return Response.json(data, { status: response.status });
  }

  return Response.json(data);
}
