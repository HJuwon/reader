import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

/**
 * 책 목록 조회
 *
 * books = 책 자체의 기본 정보
 * reading_rounds = 몇 회차 읽었는지
 * reading_progress = 현재 회차의 진행 상황
 */
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
    // 1. 책 목록
    const { data: books, error: booksError } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (booksError) {
      console.error("BOOKS GET ERROR:", booksError);

      return Response.json(
        { error: booksError.message },
        { status: 500 }
      );
    }

    if (!books || books.length === 0) {
      return Response.json({
        data: [],
      });
    }

    const bookIds = books.map((book) => book.id);

    // 2. 해당 책들의 독서 회차
    const { data: rounds, error: roundsError } = await supabase
      .from("reading_rounds")
      .select("*")
      .eq("user_id", userId)
      .in("book_id", bookIds)
      .order("round", { ascending: true });

    if (roundsError) {
      console.error("READING ROUNDS GET ERROR:", roundsError);

      return Response.json(
        { error: roundsError.message },
        { status: 500 }
      );
    }

    const roundIds = (rounds ?? []).map((round) => round.id);

    // 3. 독서 진행 상황
    let progresses: any[] = [];

    if (roundIds.length > 0) {
      const { data, error: progressError } = await supabase
        .from("reading_progress")
        .select("*")
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

      progresses = data ?? [];
    }

    // 4. 책마다 회차/진행상황을 묶어서 반환
    const result = books.map((book) => {
      const bookRounds =
        rounds?.filter(
          (round) => round.book_id === book.id
        ) ?? [];

      const activeRound =
        [...bookRounds]
          .reverse()
          .find((round) => round.status === "reading") ??
        bookRounds[bookRounds.length - 1] ??
        null;

      const activeProgress = activeRound
        ? progresses.find(
            (progress) =>
              progress.round_id === activeRound.id
          ) ?? null
        : null;

      return {
        ...book,

        // 회차 정보
        rounds: bookRounds,
        round_count: bookRounds.length,
        completed_round_count: bookRounds.filter(
          (round) => round.status === "completed"
        ).length,

        // 현재 회차
        current_round: activeRound?.round ?? null,
        current_round_id: activeRound?.id ?? null,

        // 현재 회차 진행상황
        current_episode:
          activeProgress?.episode ?? 0,
        current_progress:
          activeProgress?.progress ?? 0,
        current_scroll_position:
          activeProgress?.scroll_position ?? 0,
      };
    });

    return Response.json({
      data: result,
    });
  } catch (error) {
    console.error("BOOKS GET UNEXPECTED ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "책 목록 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * 책 생성 + 최초 독서 회차 생성
 *
 * 새 책을 처음 열었을 때 호출.
 *
 * 처리 순서:
 * 1. books에 책이 있는지 확인
 * 2. 없으면 books 생성
 * 3. reading_rounds에 1회차 생성
 * 4. reading_progress에 1회차 진행상황 생성
 *
 * 이미 존재하면 기존 책/현재 회차를 반환.
 */
export async function POST(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const userId = session.user.email;

  try {
    const body = await request.json();

    const {
      drive_file_id,
      title,
      total_episodes,
    } = body;

    if (!drive_file_id) {
      return Response.json(
        { error: "drive_file_id가 필요합니다." },
        { status: 400 }
      );
    }

    if (!title) {
      return Response.json(
        { error: "title이 필요합니다." },
        { status: 400 }
      );
    }

    if (
      typeof total_episodes !== "number" ||
      total_episodes < 0
    ) {
      return Response.json(
        { error: "total_episodes가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 1. 기존 책 확인
    // --------------------------------------------------

    const { data: existingBook, error: findBookError } =
      await supabase
        .from("books")
        .select("*")
        .eq("user_id", userId)
        .eq("drive_file_id", drive_file_id)
        .maybeSingle();

    if (findBookError) {
      console.error(
        "BOOK FIND ERROR:",
        findBookError
      );

      return Response.json(
        { error: findBookError.message },
        { status: 500 }
      );
    }

    let book = existingBook;

    // --------------------------------------------------
    // 2. 책이 없으면 생성
    // --------------------------------------------------

    if (!book) {
      const { data: newBook, error: bookInsertError } =
        await supabase
          .from("books")
          .insert({
            user_id: userId,
            drive_file_id,
            title,
            total_episodes,
            last_episode: 0,
            progress: 0,
            status: "안읽음",
            scroll_position: 0,
          })
          .select()
          .single();

      if (bookInsertError) {
        console.error(
          "BOOK INSERT ERROR:",
          bookInsertError
        );

        return Response.json(
          { error: bookInsertError.message },
          { status: 500 }
        );
      }

      book = newBook;
    }

    // --------------------------------------------------
    // 3. 기존 회차 확인
    // --------------------------------------------------

    const { data: existingRounds, error: roundsError } =
      await supabase
        .from("reading_rounds")
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", book.id)
        .order("round", { ascending: true });

    if (roundsError) {
      console.error(
        "READING ROUNDS FIND ERROR:",
        roundsError
      );

      return Response.json(
        { error: roundsError.message },
        { status: 500 }
      );
    }

    let rounds = existingRounds ?? [];

    // --------------------------------------------------
    // 4. 회차가 하나도 없으면 1회차 생성
    // --------------------------------------------------

    if (rounds.length === 0) {
      const { data: newRound, error: roundInsertError } =
        await supabase
          .from("reading_rounds")
          .insert({
            user_id: userId,
            book_id: book.id,
            round: 1,
            status: "reading",
          })
          .select()
          .single();

      if (roundInsertError) {
        console.error(
          "READING ROUND INSERT ERROR:",
          roundInsertError
        );

        return Response.json(
          { error: roundInsertError.message },
          { status: 500 }
        );
      }

      rounds = [newRound];

      // --------------------------------------------------
      // 5. 1회차 진행상황 생성
      // --------------------------------------------------

      const { error: progressInsertError } =
        await supabase
          .from("reading_progress")
          .insert({
            round_id: newRound.id,
            episode: 0,
            progress: 0,
            scroll_position: 0,
          });

      if (progressInsertError) {
        console.error(
          "READING PROGRESS INSERT ERROR:",
          progressInsertError
        );

        return Response.json(
          { error: progressInsertError.message },
          { status: 500 }
        );
      }
    }

    // --------------------------------------------------
    // 6. 현재 읽고 있는 회차 찾기
    // --------------------------------------------------

    const currentRound =
      [...rounds]
        .reverse()
        .find((round) => round.status === "reading") ??
      rounds[rounds.length - 1];

    // --------------------------------------------------
    // 7. 현재 회차 진행상황 조회
    // --------------------------------------------------

    const { data: progress, error: progressError } =
      await supabase
        .from("reading_progress")
        .select("*")
        .eq("round_id", currentRound.id)
        .maybeSingle();

    if (progressError) {
      console.error(
        "READING PROGRESS FIND ERROR:",
        progressError
      );

      return Response.json(
        { error: progressError.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: {
        book,
        rounds,
        current_round: currentRound,
        progress: progress ?? {
          episode: 0,
          progress: 0,
          scroll_position: 0,
        },
      },
    });
  } catch (error) {
    console.error("BOOKS POST UNEXPECTED ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "책 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * 현재 독서 진행상황 저장
 *
 * 기존:
 *   books.last_episode
 *   books.progress
 *   books.scroll_position
 *
 * 앞으로:
 *   reading_progress.episode
 *   reading_progress.progress
 *   reading_progress.scroll_position
 *
 * 완료 여부:
 *   reading_rounds.status
 */
export async function PATCH(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const userId = session.user.email;

  try {
    const body = await request.json();

    const {
      drive_file_id,
      round_id,
      episode,
      progress,
      scroll_position,
      status,
    } = body;

    if (!drive_file_id) {
      return Response.json(
        { error: "drive_file_id가 필요합니다." },
        { status: 400 }
      );
    }

    if (
      typeof episode !== "number" ||
      typeof progress !== "number" ||
      typeof scroll_position !== "number"
    ) {
      return Response.json(
        {
          error:
            "episode, progress, scroll_position이 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (progress < 0 || progress > 100) {
      return Response.json(
        { error: "progress는 0~100 사이여야 합니다." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 1. 책 확인
    // --------------------------------------------------

    const { data: book, error: bookError } =
      await supabase
        .from("books")
        .select("*")
        .eq("user_id", userId)
        .eq("drive_file_id", drive_file_id)
        .maybeSingle();

    if (bookError) {
      console.error(
        "BOOK FIND FOR PATCH ERROR:",
        bookError
      );

      return Response.json(
        { error: bookError.message },
        { status: 500 }
      );
    }

    if (!book) {
      return Response.json(
        {
          error:
            "해당 Drive 파일에 대한 책 정보를 찾지 못했습니다.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 2. round_id가 없으면 현재 회차 찾기
    // --------------------------------------------------

    let currentRoundId = round_id;

    if (!currentRoundId) {
      const { data: currentRound, error: roundError } =
        await supabase
          .from("reading_rounds")
          .select("*")
          .eq("user_id", userId)
          .eq("book_id", book.id)
          .eq("status", "reading")
          .order("round", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (roundError) {
        console.error(
          "CURRENT ROUND FIND ERROR:",
          roundError
        );

        return Response.json(
          { error: roundError.message },
          { status: 500 }
        );
      }

      if (!currentRound) {
        return Response.json(
          {
            error:
              "현재 읽고 있는 회차를 찾지 못했습니다.",
          },
          { status: 404 }
        );
      }

      currentRoundId = currentRound.id;
    }

    // --------------------------------------------------
    // 3. round_id가 이 사용자의 이 책에 속하는지 확인
    // --------------------------------------------------

    const { data: round, error: verifyRoundError } =
      await supabase
        .from("reading_rounds")
        .select("*")
        .eq("id", currentRoundId)
        .eq("user_id", userId)
        .eq("book_id", book.id)
        .maybeSingle();

    if (verifyRoundError) {
      console.error(
        "ROUND VERIFY ERROR:",
        verifyRoundError
      );

      return Response.json(
        { error: verifyRoundError.message },
        { status: 500 }
      );
    }

    if (!round) {
      return Response.json(
        { error: "올바르지 않은 reading round입니다." },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 4. reading_progress 저장
    // --------------------------------------------------

    const { data: savedProgress, error: progressError } =
      await supabase
        .from("reading_progress")
        .upsert(
          {
            round_id: currentRoundId,
            episode,
            progress,
            scroll_position,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "round_id",
          }
        )
        .select()
        .single();

    if (progressError) {
      console.error(
        "READING PROGRESS UPDATE ERROR:",
        progressError
      );

      return Response.json(
        { error: progressError.message },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 5. 완독이면 reading_rounds 상태 변경
    // --------------------------------------------------

    let savedRound = round;

    if (status === "completed") {
      const { data: completedRound, error: completeError } =
        await supabase
          .from("reading_rounds")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", currentRoundId)
          .eq("user_id", userId)
          .eq("book_id", book.id)
          .select()
          .single();

      if (completeError) {
        console.error(
          "READING ROUND COMPLETE ERROR:",
          completeError
        );

        return Response.json(
          { error: completeError.message },
          { status: 500 }
        );
      }

      savedRound = completedRound;
    }

    // --------------------------------------------------
    // 6. books의 기존 진행상황도 일단 동기화
    //
    // 기존 화면 코드가 아직 books의 값을 사용하므로
    // 완전히 제거하기 전까지는 같이 저장.
    // --------------------------------------------------

    const { data: updatedBook, error: bookUpdateError } =
      await supabase
        .from("books")
        .update({
          last_episode: episode,
          progress,
          status:
            status === "completed"
              ? "완독"
              : "읽는 중",
          scroll_position,
          updated_at: new Date().toISOString(),
        })
        .eq("id", book.id)
        .eq("user_id", userId)
        .eq("drive_file_id", drive_file_id)
        .select()
        .single();

    if (bookUpdateError) {
      console.error(
        "BOOK LEGACY PROGRESS UPDATE ERROR:",
        bookUpdateError
      );

      return Response.json(
        { error: bookUpdateError.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: {
        book: updatedBook,
        round: savedRound,
        progress: savedProgress,
      },
    });
  } catch (error) {
    console.error("BOOKS PATCH UNEXPECTED ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "진행상황 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
