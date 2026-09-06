import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";
import { parseNovel } from "@/lib/parser";

// 파일명에서 연재 상태 추출
// "미완"이 "완"을 포함하므로 반드시 미완부터 검사
function extractSeriesStatus(
  fileName: string
): "ongoing" | "completed" {
  if (/\(미완\)/.test(fileName)) {
    return "ongoing";
  }

  if (/\(완\)/.test(fileName)) {
    return "completed";
  }

  return "ongoing"; // 태그가 없으면 기본값
}

// 제목에서 "(완)" / "(미완)" 태그 제거
function cleanTitle(fileName: string): string {
  return fileName
    .replace(/\.txt$/i, "")
    .replace(/\s*\(미완\)\s*/g, "")
    .replace(/\s*\(완\)\s*/g, "")
    .trim();
}

export async function GET() {
  const session: any = await getServerSession(authOptions);

  // 1. 로그인 확인
  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const folderId = process.env.GOOGLE_DRIVE_NOVEL_FOLDER_ID;

  // 2. 소설 폴더 ID 확인
  if (!folderId) {
    return Response.json(
      { error: "소설 폴더 ID가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    // =========================================================
    // 1. Google Drive에서 현재 소설 폴더의 TXT 파일 목록 조회
    // =========================================================

    const q = `'${folderId}' in parents and trashed = false`;

    const url = new URL(
      "https://www.googleapis.com/drive/v3/files"
    );

    url.searchParams.set("q", q);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("orderBy", "name");
    url.searchParams.set(
      "fields",
      "files(id,name,mimeType,modifiedTime,size)"
    );

    const driveResponse = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const driveData = await driveResponse.json();

    if (!driveResponse.ok) {
      return Response.json(
        {
          error:
            driveData?.error?.message ||
            "Google Drive 파일 목록을 가져오지 못했습니다.",
        },
        { status: driveResponse.status }
      );
    }

    // TXT 파일만 사용
    const files = (driveData.files || []).filter(
      (file: any) =>
        file.mimeType === "text/plain" ||
        file.name?.toLowerCase().endsWith(".txt")
    );

    // =========================================================
    // 2. 현재 사용자의 DB에 등록된 Drive 파일 ID 조회
    // =========================================================

    const { data: existingBooks, error: existingError } =
      await supabase
        .from("books")
        .select("drive_file_id")
        .eq("user_id", session.user.email);

    if (existingError) {
      return Response.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    // DB에 이미 등록된 Drive 파일 ID를 Set으로 관리
    const existingIds = new Set(
      (existingBooks || []).map(
        (book: any) => book.drive_file_id
      )
    );

    // =========================================================
    // 3. Drive에는 있지만 DB에는 없는 파일만 찾기
    // =========================================================

    const newFiles = files.filter(
      (file: any) => !existingIds.has(file.id)
    );

    // 새로 DB에 등록된 책
    const insertedBooks = [];

    // =========================================================
    // 4. 새 파일만 Drive에서 TXT를 가져와 파싱 후 DB 등록
    // =========================================================

    for (const file of newFiles) {
      try {
        // 새 파일의 실제 TXT 내용 가져오기
        const fileResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
            file.id
          )}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        if (!fileResponse.ok) {
          console.error(
            `파일 읽기 실패: ${file.name}`,
            await fileResponse.text()
          );

          continue;
        }

        const content = await fileResponse.text();

        // TXT 파싱
        const parsed = parseNovel(content);

        // =====================================================
        // 5. DB에 새 책 등록
        // =====================================================
        const { data, error } = await supabase
          .from("books")
          .upsert(
            {      
              user_id: session.user.email,
              drive_file_id: file.id,
              title: cleanTitle(file.name),
              series_status: extractSeriesStatus(file.name),
              total_episodes: parsed.totalEpisodes,
              last_episode: 0,
              progress: 0,
              status: "안 읽음",
            },
            {
              onConflict: "user_id,drive_file_id",
              ignoreDuplicates: true,
            }
          )
          .select()
          .maybeSingle();
        

        if (error) {
          console.error(
            `DB 등록 실패: ${file.name}`,
            error
          );

          continue;
        }

        if (data) {
          insertedBooks.push(data);
        }
      } catch (error) {
        console.error(
          `파일 처리 실패: ${file.name}`,
          error
        );
      }
    }

    // =========================================================
    // 6. 결과 반환
    // =========================================================

    return Response.json({
      success: true,

      // 현재 Drive에 있는 TXT 파일 수
      totalDriveFiles: files.length,

      // Drive에는 있지만 DB에는 없었던 파일 수
      newFiles: newFiles.length,

      // 실제 DB에 새로 등록된 파일 수
      inserted: insertedBooks.length,

      // 이번에 새로 등록된 책
      books: insertedBooks,
    });
  } catch (error) {
    console.error("BOOK SYNC ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "소설 동기화 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
