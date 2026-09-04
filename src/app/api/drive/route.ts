import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";

export async function GET(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") || "root";

  const q = `'${folderId}' in parents and trashed = false`;

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("orderBy", "folder,name");
  url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,size)");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    return Response.json(data, { status: response.status });
  }

  return Response.json(data);
}