import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

// 파일명에서 연재 상태 추출
// "미완"이 "완"을 포함하므로 반드시 미완부터 검사
function extractSeriesStatus(
  fileName: string
): "ongoing" | "completed" {
  if (/\(미완\)/.test(fileName)) return "ongoing";
  if (/\(완\)/.test(fileName)) return "completed";
  return "ongoing";
}

// 제목에서 "(완)" / "(미완)" 태그 제거
function cleanTitle(fileName: string): string {
  return fileName
    .replace(/\.txt$/i, "")
    .replace(/\s*\(미완\)\s*/g, "")
    .replace(/\s*\(완\)\s*/g, "")
    .trim();
}

// 배열을 chunkSize개씩 묶기 위한 헬퍼
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
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
    //    (메타데이터만, 파일 내용은 안 받아옴)
    // =========================================================

    const q = `'${folderId}' in parents and trashed = false`;
    let allFiles: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const url = new URL(
        "https://www.googleapis.com/drive/v3/files"
      );

      url.searchParams.set("q", q);
      url.searchParams.set("pageSize", "1000");
      url.searchParams.set("orderBy", "name");
      url.searchParams.set(
        "fields",
        "nextPageToken,files(id,name,mimeType,modifiedTime,size)"
      );

      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

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

      allFiles = allFiles.concat(driveData.files || []);
      pageToken = driveData.nextPageToken;
    } while (pageToken);

    // TXT 파일만 사용
    const files = allFiles.filter(
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

    const existingIds = new Set(
      (existingBooks || []).map(
        (book: any) => book.drive_file_id
      )
    );

    // =========================================================
    // 3. 새 파일 / 기존 파일 분리
    // =========================================================

    const newFiles = files.filter(
      (file: any) => !existingIds.has(file.id)
    );

    const existingFiles = files.filter((file: any) =>
      existingIds.has(file.id)
    );

    // =========================================================
    // 4. 새 파일 등록 — 내용 다운로드/파싱 없이 메타데이터만
    //    (total_episodes는 0으로 두고, 책을 처음 열 때
    //     리더 화면에서 실제 내용을 읽고 채워넣음)
    // =========================================================

    const insertedBooks: any[] = [];
    const insertBatches = chunk(newFiles, 50);

    for (const batch of insertBatches) {
      const rows = batch.map((file: any) => ({
        user_id: session.user.email,
        drive_file_id: file.id,
        title: cleanTitle(file.name),
        series_status: extractSeriesStatus(file.name),
        total_episodes: 0,
        last_episode: 0,
        progress: 0,
        status: "안 읽음",
      }));

      const { data, error } = await supabase
        .from("books")
        .upsert(rows, {
          onConflict: "user_id,drive_file_id",
          ignoreDuplicates: true,
        })
        .select();

      if (error) {
        console.error("배치 등록 실패:", error);
        continue;
      }

      if (data) {
        insertedBooks.push(...data);
      }
    }

    // =========================================================
    // 5. 기존 파일: title / series_status만 파일명 기준으로 갱신
    //    (진행상황 컬럼은 절대 건드리지 않음)
    // =========================================================

    let updatedCount = 0;
    const updateBatches = chunk(existingFiles, 50);

    for (const batch of updateBatches) {
      const results = await Promise.all(
        batch.map(async (file: any) => {
          const { error } = await supabase
            .from("books")
            .update({
              title: cleanTitle(file.name),
              series_status: extractSeriesStatus(file.name),
            })
            .eq("user_id", session.user.email)
            .eq("drive_file_id", file.id);

          if (error) {
            console.error(
              `기존 책 갱신 실패: ${file.name}`,
              error
            );
            return false;
          }

          return true;
        })
      );

      updatedCount += results.filter(Boolean).length;
    }

    // =========================================================
    // 6. 결과 반환
    // =========================================================

    return Response.json({
      success: true,
      totalDriveFiles: files.length,
      newFiles: newFiles.length,
      inserted: insertedBooks.length,
      updated: updatedCount,
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
