import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const userId = session.user.email;

  try {
    // --------------------------------------------------
    // 1. 책 + 회차를 병렬 조회
    // --------------------------------------------------

    const [booksResult, roundsResult] = await Promise.all([
      supabase
        .from("books")
        .select(
          "id,user_id,drive_file_id,title,total_episodes,last_episode,progress,status,created_at,updated_at,scroll_position"
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),

      supabase
        .from("reading_rounds")
        .select(
          "id,user_id,book_id,round,status,started_at,completed_at,created_at"
        )
        .eq("user_id", userId)
        .order("round", { ascending: true }),
    ]);

    const {
      data: books,
      error: booksError,
    } = booksResult;

    if (booksError) {
      console.error("BOOKS GET ERROR:", booksError);

      return Response.json(
        { error: booksError.message },
        { status: 500 }
      );
    }

    const {
      data: rounds,
      error: roundsError,
    } = roundsResult;

    if (roundsError) {
      console.error(
        "READING ROUNDS GET ERROR:",
        roundsError
      );

      return Response.json(
        { error: roundsError.message },
        { status: 500 }
      );
    }

    const bookList = books ?? [];
    const roundList = rounds ?? [];

    if (bookList.length === 0) {
      return Response.json({
        success: true,
        data: [],
      });
    }

    // --------------------------------------------------
    // 2. 회차별 진행상황 조회
    // --------------------------------------------------

    const roundIds = roundList.map(
      (round) => round.id
    );

    let progressList: any[] = [];

    if (roundIds.length > 0) {
      const {
        data: progress,
        error: progressError,
      } = await supabase
        .from("reading_progress")
        .select(
          "id,round_id,episode,progress,scroll_position,updated_at"
        )
        .in("round_id", roundIds);

      if (progressError) {
        console.error(
          "READING PROGRESS GET ERROR:",
          progressError
        );

        return Response.json(
          { error: progressError.message },
          { status: 500 }
        );
      }

      progressList = progress ?? [];
    }

    // --------------------------------------------------
    // 3. Map 생성
    //
    // 기존 filter/find 반복 제거
    // --------------------------------------------------

    const roundsByBook = new Map<
      string,
      any[]
    >();

    for (const round of roundList) {
      const list =
        roundsByBook.get(round.book_id) ?? [];

      list.push(round);
      roundsByBook.set(
        round.book_id,
        list
      );
    }

    const progressByRound = new Map<
      string,
      any
    >();

    for (const progress of progressList) {
      progressByRound.set(
        progress.round_id,
        progress
      );
    }

    // --------------------------------------------------
    // 4. 책별 데이터 조합
    // --------------------------------------------------

    const result = bookList.map((book) => {
      const bookRounds =
        roundsByBook.get(book.id) ?? [];

      const currentRound =
        [...bookRounds]
          .reverse()
          .find(
            (round) =>
              round.status === "reading"
          ) ??
        bookRounds[
          bookRounds.length - 1
        ] ??
        null;

      const currentProgress =
        currentRound
          ? progressByRound.get(
              currentRound.id
            ) ?? null
          : null;

      return {
        ...book,

        rounds: bookRounds,

        round_count:
          bookRounds.length,

        completed_round_count:
          bookRounds.filter(
            (round) =>
              round.status === "completed"
          ).length,

        current_round:
          currentRound?.round ?? null,

        current_round_id:
          currentRound?.id ?? null,

        current_episode:
          currentProgress?.episode ?? 0,

        current_progress:
          currentProgress?.progress ?? 0,

        current_scroll_position:
          currentProgress?.scroll_position ?? 0,
      };
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "BOOKS GET UNEXPECTED ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "책 목록을 불러오는 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
