import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";
import { getDriveAccessToken } from "@/lib/googleToken";

export const maxDuration = 60;

/**
 * DB(books)와 구글 드라이브 폴더를 비교해서 보여주는 점검 페이지.
 *   GET  /api/books/compare  → 표 (중복 의심 + 드라이브에 없는 책)
 *   POST /api/books/compare  → { bookId } 드라이브에 없는 책 하나를 연결 데이터와 함께 삭제
 */

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  createdTime?: string;
  modifiedTime?: string;
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
  });
}

// 비교용 제목: "1 -"부터 뒤를 지우고 앞뒤 공백 제거
function normalizeTitle(title: string): string {
  return title
    .replace(/\s*1\s*-.*$/, "")
    .trim()
    .toLowerCase();
}

async function listDriveFiles(
  accessToken: string,
  folderId: string
): Promise<{ files: DriveFile[]; error?: string }> {
  const q = `'${folderId}' in parents and trashed = false`;
  let files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      "https://www.googleapis.com/drive/v3/files"
    );

    url.searchParams.set("q", q);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime)"
    );

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        files: [],
        error:
          data?.error?.message ||
          "Google Drive 파일 목록을 가져오지 못했습니다.",
      };
    }

    files = files.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return {
    files: files.filter(
      (file) =>
        file.mimeType === "text/plain" ||
        file.name?.toLowerCase().endsWith(".txt")
    ),
  };
}

export async function GET() {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("로그인이 필요합니다.", { status: 401 });
  }

  const accessToken = await getDriveAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_NOVEL_FOLDER_ID;

  if (!accessToken || !folderId) {
    return new Response(
      "Google 로그인이 만료되었거나 소설 폴더 ID가 설정되지 않았습니다.",
      { status: 500 }
    );
  }

  const { files, error: driveError } = await listDriveFiles(
    accessToken,
    folderId
  );

  if (driveError) {
    return new Response(driveError, { status: 500 });
  }

  const { data: books, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", session.user.email);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const driveMap = new Map(files.map((file) => [file.id, file]));

  type Row = {
    id: string;
    title: string;
    driveFileId: string;
    dbCreated?: string;
    dbUpdated?: string;
    drive?: DriveFile;
    norm: string;
  };

  const rows: Row[] = (books || []).map((book: any) => ({
    id: book.id,
    title: book.title ?? "",
    driveFileId: book.drive_file_id,
    dbCreated: book.created_at,
    dbUpdated: book.updated_at,
    drive: driveMap.get(book.drive_file_id),
    norm: normalizeTitle(book.title ?? ""),
  }));

  // 중복 의심: 정리한 제목이 같은 책이 2개 이상
  const groups = new Map<string, Row[]>();

  rows.forEach((row) => {
    const list = groups.get(row.norm) ?? [];
    list.push(row);
    groups.set(row.norm, list);
  });

  const duplicateRows = rows
    .filter((row) => (groups.get(row.norm)?.length ?? 0) > 1)
    .sort(
      (a, b) =>
        a.norm.localeCompare(b.norm, "ko") ||
        (a.dbCreated ?? "").localeCompare(b.dbCreated ?? "")
    );

  const missingRows = rows.filter((row) => !row.drive);

  const renderRow = (row: Row) => {
    const inDrive = !!row.drive;

    return `<tr style="background:${inDrive ? "#fff" : "#fee2e2"}">
      <td>${esc(row.title)}</td>
      <td>${inDrive ? esc(row.drive!.name) : "-"}</td>
      <td>${fmt(row.drive?.createdTime)}</td>
      <td>${fmt(row.drive?.modifiedTime)}</td>
      <td>${fmt(row.dbCreated)}</td>
      <td>${inDrive ? "있음" : "<b>없음</b>"}</td>
      <td>${
        inDrive
          ? ""
          : `<button onclick="del('${esc(row.id)}', this)">DB에서 삭제</button>`
      }</td>
    </tr>`;
  };

  const header = `<tr>
    <th>DB 제목</th><th>드라이브 파일명</th>
    <th>파일 만든 날</th><th>파일 수정일</th>
    <th>DB 등록일</th><th>드라이브</th><th></th>
  </tr>`;

  const html = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DB · 드라이브 비교</title>
<style>
  body{font-family:system-ui,sans-serif;margin:12px;font-size:13px;color:#111}
  table{border-collapse:collapse;min-width:100%}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f3f4f6;position:sticky;top:0}
  .wrap{overflow-x:auto;margin-bottom:24px}
  button{padding:4px 8px}
  .note{color:#555;line-height:1.5}
</style></head><body>
<h3>DB · 드라이브 비교</h3>
<p class="note">
  DB ${rows.length}권 / 드라이브 ${files.length}개.<br>
  <b>파일 만든 날·수정일</b>은 구글 드라이브 파일의 날짜이고,
  <b>DB 등록일</b>은 이 앱 DB에 처음 들어온 날입니다.<br>
  분홍색 줄은 드라이브에 없는데 DB에만 남은 책입니다. (삭제 대상)
</p>

<h4>중복 의심 (제목에서 "1 -" 뒤를 지우고 비교) — ${duplicateRows.length}건</h4>
<div class="wrap"><table>${header}${duplicateRows.map(renderRow).join("")}</table></div>

<h4>드라이브에 없는데 DB에 남은 책 — ${missingRows.length}건</h4>
<div class="wrap"><table>${header}${missingRows.map(renderRow).join("")}</table></div>

<script>
async function del(bookId, btn){
  if(!confirm("DB에서 이 책과 읽기 기록을 삭제합니다. 계속할까요?")) return;
  btn.disabled = true;
  btn.textContent = "삭제 중";
  try{
    const res = await fetch("/api/books/compare",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({bookId})
    });
    const data = await res.json();
    if(res.ok){
      btn.closest("tr").remove();
    }else{
      alert("삭제 실패: " + (data.error || res.status) + (data.details ? "\\n" + data.details.join("\\n") : ""));
      btn.disabled = false;
      btn.textContent = "DB에서 삭제";
    }
  }catch(e){
    alert("오류: " + e);
    btn.disabled = false;
    btn.textContent = "DB에서 삭제";
  }
}
</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId: string = session.user.email;

  let bookId = "";

  try {
    const body = await request.json();
    bookId = typeof body.bookId === "string" ? body.bookId : "";
  } catch {
    bookId = "";
  }

  if (!bookId) {
    return Response.json({ error: "bookId가 필요합니다." }, { status: 400 });
  }

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, drive_file_id, title")
    .eq("user_id", userId)
    .eq("id", bookId)
    .maybeSingle();

  if (bookError || !book) {
    return Response.json(
      { error: bookError?.message ?? "책을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 안전장치: 드라이브에 아직 있는 책은 지우지 않는다.
  const accessToken = await getDriveAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_NOVEL_FOLDER_ID;

  if (!accessToken || !folderId) {
    return Response.json(
      { error: "Google 로그인이 만료되었거나 폴더 ID가 없습니다." },
      { status: 500 }
    );
  }

  const { files, error: driveError } = await listDriveFiles(
    accessToken,
    folderId
  );

  if (driveError) {
    return Response.json({ error: driveError }, { status: 500 });
  }

  if (files.some((file) => file.id === book.drive_file_id)) {
    return Response.json(
      { error: "이 책은 드라이브에 아직 있어서 삭제하지 않았습니다." },
      { status: 409 }
    );
  }

  const details: string[] = [];

  const run = async (
    label: string,
    task: PromiseLike<{ error: any }>,
    ignoreMissingTable = false
  ) => {
    const { error } = await task;

    if (!error) return;

    if (
      ignoreMissingTable &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        /does not exist|schema cache/i.test(error.message ?? ""))
    ) {
      return;
    }

    details.push(`${label}: ${error.message ?? error}`);
  };

  const { data: rounds } = await supabase
    .from("reading_rounds")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", book.id);

  const roundIds = (rounds || []).map((r: any) => r.id);

  if (roundIds.length > 0) {
    await run(
      "읽기 진행상황",
      supabase.from("reading_progress").delete().in("round_id", roundIds)
    );
  }

  await run(
    "읽기 회차",
    supabase
      .from("reading_rounds")
      .delete()
      .eq("user_id", userId)
      .eq("book_id", book.id)
  );

  await run(
    "북마크",
    supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("book_id", book.id)
  );

  await run(
    "하이라이트",
    supabase
      .from("highlights")
      .delete()
      .eq("user_id", userId)
      .eq("book_id", book.id)
  );

  await run(
    "소설별 회차 규칙",
    supabase
      .from("book_episode_rules")
      .delete()
      .eq("user_id", userId)
      .eq("drive_file_id", book.drive_file_id),
    true
  );

  const { error: deleteError } = await supabase
    .from("books")
    .delete()
    .eq("user_id", userId)
    .eq("id", book.id);

  if (deleteError) {
    return Response.json(
      {
        error: `books 삭제 실패: ${deleteError.message}`,
        details,
      },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, details });
}
