import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

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
      restart = false,
    } = body;

    // --------------------------------------------------
    // 기본값 검증
    // --------------------------------------------------

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

    const {
      data: existingBook,
      error: findBookError,
    } = await supabase
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
      const {
        data: newBook,
        error: bookInsertError,
      } = await supabase
        .from("books")
        .insert({
          user_id: userId,
          drive_file_id,
          title,
          total_episodes,
          last_episode: 0,
          progress: 0,
          status: "읽는 중",
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
    } else {
      // --------------------------------------------------
      // 2-1. 기존 책 정보만 최신화
      //
      // 중요:
      // 여기서 status를 무조건 "읽는 중"으로 바꾸면 안 됨.
      // 완독 책을 단순히 다시 열었을 때
      // "완독" 상태를 유지해야 함.
      // --------------------------------------------------

      const {
        data: updatedExistingBook,
        error: existingBookUpdateError,
      } = await supabase
        .from("books")
        .update({
          title,
          total_episodes,
        })
        .eq("id", book.id)
        .eq("user_id", userId)
        .eq("drive_file_id", drive_file_id)
        .select()
        .single();

      if (existingBookUpdateError) {
        console.error(
          "EXISTING BOOK UPDATE ERROR:",
          existingBookUpdateError
        );

        return Response.json(
          { error: existingBookUpdateError.message },
          { status: 500 }
        );
      }

      book = updatedExistingBook;
    }

    // --------------------------------------------------
    // 3. 기존 회차 조회
    // --------------------------------------------------

    const {
      data: existingRounds,
      error: roundsError,
    } = await supabase
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
    // 4. 최초 독서
    // --------------------------------------------------

    if (rounds.length === 0) {
      const {
        data: newRound,
        error: roundInsertError,
      } = await supabase
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

      const {
        error: progressInsertError,
      } = await supabase
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

      rounds = [newRound];
    }

    // --------------------------------------------------
    // 5. 다시 읽기
    //
    // restart=true일 때만 새로운 회차 생성
    //
    // 예:
    // 1회차 completed
    // → 2회차 reading
    //
    // 기존 회차는 절대 수정하지 않음.
    // --------------------------------------------------

    if (restart) {
      const latestRound =
        rounds[rounds.length - 1];

      // 이미 읽는 중인 회차가 있다면
      // 새로운 회차를 만들지 않고 기존 회차 사용
      if (
        latestRound &&
        latestRound.status === "reading"
      ) {
        const {
          data: existingProgress,
          error: existingProgressError,
        } = await supabase
          .from("reading_progress")
          .select("*")
          .eq("round_id", latestRound.id)
          .maybeSingle();

        if (existingProgressError) {
          return Response.json(
            { error: existingProgressError.message },
            { status: 500 }
          );
        }

        const {
          data: readingBook,
          error: readingBookError,
        } = await supabase
          .from("books")
          .update({
            status: "읽는 중",
            updated_at: new Date().toISOString(),
          })
          .eq("id", book.id)
          .eq("user_id", userId)
          .eq("drive_file_id", drive_file_id)
          .select()
          .single();

        if (readingBookError) {
          return Response.json(
            { error: readingBookError.message },
            { status: 500 }
          );
        }

        return Response.json({
          success: true,
          data: {
            book: readingBook,
            rounds,
            current_round: latestRound,
            progress:
              existingProgress ?? {
                round_id: latestRound.id,
                episode: 0,
                progress: 0,
                scroll_position: 0,
              },
          },
        });
      }

      // 마지막 회차가 완독이면
      // 다음 번호로 새 회차 생성
      const nextRoundNumber =
        Math.max(
          ...rounds.map(
            (round) => round.round
          )
        ) + 1;

      const {
        data: newRound,
        error: newRoundError,
      } = await supabase
        .from("reading_rounds")
        .insert({
          user_id: userId,
          book_id: book.id,
          round: nextRoundNumber,
          status: "reading",
        })
        .select()
        .single();

      if (newRoundError) {
        console.error(
          "NEW READING ROUND INSERT ERROR:",
          newRoundError
        );

        return Response.json(
          { error: newRoundError.message },
          { status: 500 }
        );
      }

      const {
        data: newProgress,
        error: newProgressError,
      } = await supabase
        .from("reading_progress")
        .insert({
          round_id: newRound.id,
          episode: 0,
          progress: 0,
          scroll_position: 0,
        })
        .select()
        .single();

      if (newProgressError) {
        console.error(
          "NEW READING PROGRESS INSERT ERROR:",
          newProgressError
        );

        return Response.json(
          { error: newProgressError.message },
          { status: 500 }
        );
      }

      rounds = [
        ...rounds,
        newRound,
      ];

      // 새 회차가 시작됐으므로
      // books의 현재 상태만 새 회차 기준으로 변경
      const {
        data: restartedBook,
        error: restartedBookError,
      } = await supabase
        .from("books")
        .update({
          status: "읽는 중",
          last_episode: 0,
          progress: 0,
          scroll_position: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", book.id)
        .eq("user_id", userId)
        .eq("drive_file_id", drive_file_id)
        .select()
        .single();

      if (restartedBookError) {
        console.error(
          "RESTART BOOK UPDATE ERROR:",
          restartedBookError
        );

        return Response.json(
          { error: restartedBookError.message },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        data: {
          book: restartedBook,
          rounds,
          current_round: newRound,
          progress: newProgress,
        },
      });
    }

    // --------------------------------------------------
    // 6. 일반적으로 책 열기
    //
    // reading 회차가 있으면 그 회차를 계속 읽음.
    // 없으면 마지막 completed 회차를 보여줌.
    // --------------------------------------------------

    const currentRound =
      [...rounds]
        .reverse()
        .find(
          (round) =>
            round.status === "reading"
        ) ??
      rounds[rounds.length - 1];

    // --------------------------------------------------
    // 7. 현재 회차 진행상황 조회
    // --------------------------------------------------

    const {
      data: progress,
      error: progressError,
    } = await supabase
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

    // --------------------------------------------------
    // 8. books 상태 동기화
    //
    // reading → 읽는 중
    // completed → 완독
    // --------------------------------------------------

    const bookStatus =
      currentRound.status === "completed"
        ? "완독"
        : "읽는 중";

    const {
      data: finalBook,
      error: finalBookError,
    } = await supabase
      .from("books")
      .update({
        status: bookStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", book.id)
      .eq("user_id", userId)
      .eq("drive_file_id", drive_file_id)
      .select()
      .single();

    if (finalBookError) {
      console.error(
        "BOOK STATUS SYNC ERROR:",
        finalBookError
      );

      return Response.json(
        { error: finalBookError.message },
        { status: 500 }
      );
    }

    book = finalBook;

    // --------------------------------------------------
    // 9. 결과 반환
    // --------------------------------------------------

    return Response.json({
      success: true,
      data: {
        book,
        rounds,
        current_round: currentRound,
        progress: progress ?? {
          round_id: currentRound.id,
          episode: 0,
          progress: 0,
          scroll_position: 0,
        },
      },
    });
  } catch (error) {
    console.error(
      "BOOKS POST UNEXPECTED ERROR:",
      error
    );

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
