import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";
import { parseNovel } from "@/lib/parser";

// Vercel 함수 최대 실행시간 (초). 요금제에 따라 상한이 다르니
// 배포 후 안 먹으면 60으로 낮춰보세요.
export const maxDuration = 300;

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

// newFiles를 chunkSize개씩 묶어서 병렬 처리하기 위한 헬퍼
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
    //    (페이지네이션: nextPageToken이 없을 때까지 반복 조회)
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

    // =========================================================
    // 4. 새 파일만 Drive에서 TXT를 가져와 파싱 후 DB 등록
    //    (10개씩 묶어서 병렬 처리 → 순차 처리보다 훨씬 빠름)
    // =========================================================

    const insertedBooks: any[] = [];
    const batches = chunk(newFiles, 10);

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (file: any) => {
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

              return null;
            }

            const content = await fileResponse.text();

            // TXT 파싱
            const parsed = parseNovel(content);

            // ===============================================
            // 5. DB에 새 책 등록
            // ===============================================
            const { data, error } = await supabase
              .from("books")
              .upsert(
                {
                  user_id: session.user.email,
                  drive_file_id: file.id,
                  title: cleanTitle(file.name),
                  series_status: extractSeriesStatus(
                    file.name
                  ),
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

              return null;
            }

            return data;
          } catch (error) {
            console.error(
              `파일 처리 실패: ${file.name}`,
              error
            );

            return null;
          }
        })
      );

      for (const data of results) {
        if (data) {
          insertedBooks.push(data);
        }
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
