import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { getDriveAccessToken } from "@/lib/googleToken";
import { isValidDriveId } from "@/lib/driveId";
import {
  applyEpisodeEdit,
  matchesOriginal,
} from "@/lib/parser/episodeEdit";

// 큰 책은 드라이브에서 받고 다시 올리는 데 시간이 걸린다.
export const maxDuration = 60;

export async function GET(request: Request) {
  const session: any = await getServerSession(authOptions);

  const accessToken = await getDriveAccessToken(session); if (!accessToken) {
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

  if (!isValidDriveId(fileId)) {
    return Response.json(
      { error: "fileId 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

  const accessToken = await getDriveAccessToken(session); if (!accessToken) {
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

  if (!isValidDriveId(fileId)) {
    return Response.json(
      { error: "fileId 형식이 올바르지 않습니다." },
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

  // 안전장치: 빈 내용이거나, 기존 파일보다 비정상적으로 짧아지면 저장하지 않는다.
  // (편집 버그나 실수로 원본이 통째로 날아가는 것을 막기 위함)
  if (content.trim().length === 0) {
    return Response.json(
      { error: "빈 내용은 저장할 수 없습니다." },
      { status: 400 }
    );
  }

  const newBytes = new TextEncoder().encode(content).length;

  const infoResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?fields=size`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (infoResponse.ok) {
    const info = await infoResponse.json().catch(() => ({}));
    const oldBytes = Number(info?.size ?? 0);

    if (oldBytes >= 5000 && newBytes < oldBytes * 0.5) {
      return Response.json(
        {
          error:
            "저장할 내용이 기존 파일보다 절반 넘게 줄어 저장하지 않았습니다. 내용을 확인해 주세요.",
        },
        { status: 409 }
      );
    }
  }

  // Google Drive의 media upload 엔드포인트로 파일 내용을 통째로 교체한다.
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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


// ======================================================
// PATCH
// 한 회차만 고쳐서 저장한다.
// 책 전체를 브라우저에서 보내면 Vercel 요청 크기 제한(약 4.5MB)에 걸리므로,
// 고친 회차만 받아서 서버가 드라이브의 원본을 받아 끼워 넣고 다시 올린다.
// ======================================================

export async function PATCH(request: Request) {
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

  if (!fileId || !isValidDriveId(fileId)) {
    return Response.json(
      { error: "fileId 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  let edit: any;

  try {
    edit = (await request.json())?.edit;
  } catch {
    return Response.json(
      { error: "요청 본문이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (
    !edit ||
    !Number.isInteger(edit.startLine) ||
    !Number.isInteger(edit.endLine) ||
    edit.startLine < 0 ||
    edit.endLine < edit.startLine ||
    typeof edit.titleLine !== "string" ||
    typeof edit.text !== "string" ||
    typeof edit.expectedOld !== "string"
  ) {
    return Response.json(
      { error: "수정 내용이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  // 1) 드라이브의 현재 원본을 받는다.
  const currentResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!currentResponse.ok) {
    return Response.json(
      { error: "원본 파일을 가져오지 못했습니다." },
      { status: currentResponse.status }
    );
  }

  const current = await currentResponse.text();

  // 2) 편집을 시작한 뒤 다른 곳에서 파일이 바뀌지 않았는지 확인한다.
  if (!matchesOriginal(current, edit)) {
    return Response.json(
      {
        error:
          "그 사이 파일이 다른 곳에서 바뀌어 저장하지 않았습니다. 책을 다시 열어서 수정해 주세요.",
      },
      { status: 409 }
    );
  }

  const updated = applyEpisodeEdit(current, edit);

  // 3) 안전장치: 빈 내용이거나 비정상적으로 짧아지면 저장하지 않는다.
  if (updated.trim().length === 0) {
    return Response.json(
      { error: "빈 내용은 저장할 수 없습니다." },
      { status: 400 }
    );
  }

  const oldBytes = new TextEncoder().encode(current).length;
  const newBytes = new TextEncoder().encode(updated).length;

  if (oldBytes >= 5000 && newBytes < oldBytes * 0.5) {
    return Response.json(
      {
        error:
          "저장할 내용이 기존 파일보다 절반 넘게 줄어 저장하지 않았습니다. 내용을 확인해 주세요.",
      },
      { status: 409 }
    );
  }

  // 4) 드라이브에 다시 올린다.
  const uploadResponse = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
      fileId
    )}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: updated,
    }
  );

  if (!uploadResponse.ok) {
    const data = await uploadResponse.json().catch(() => ({}));

    return Response.json(
      {
        error:
          data.error?.message ||
          "파일을 저장하지 못했습니다.",
      },
      { status: uploadResponse.status }
    );
  }

  return Response.json({ success: true, fileId });
}
