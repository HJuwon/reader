import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

// ======================================================
// GET
// 소설 목록 조회
// ======================================================

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
    // 1. 책 목록
    // --------------------------------------------------

    const {
      data: books,
      error: booksError,
    } = await supabase
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

    const bookList = books ?? [];

    if (bookList.length === 0) {
      return Response.json({
        success: true,
        data: [],
      });
    }

    // --------------------------------------------------
    // 2. 독서 회차 조회
    // --------------------------------------------------

    const bookIds = bookList.map(
      (book) => book.id
    );

    const {
      data: rounds,
      error: roundsError,
    } = await supabase
      .from("reading_rounds")
      .select("*")
      .eq("user_id", userId)
      .in("book_id", bookIds)
      .order("round", { ascending: true });

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

    const roundList = rounds ?? [];

    // --------------------------------------------------
    // 3. 진행상황 조회
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

      progressList = progress ?? [];
    }

    // --------------------------------------------------
    // 4. 책별 데이터 조합
    // --------------------------------------------------

    const result = bookList.map((book) => {
      const bookRounds = roundList.filter(
        (round) =>
          round.book_id === book.id
      );

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
          ? progressList.find(
              (progress) =>
                progress.round_id ===
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
              round.status ===
              "completed"
          ).length,

        current_round:
          currentRound?.round ?? null,

        current_round_id:
          currentRound?.id ?? null,

        current_episode:
          currentProgress?.episode ??
          0,

        current_progress:
          currentProgress?.progress ??
          0,

        current_scroll_position:
          currentProgress?.scroll_position ??
          0,
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

// ======================================================
// POST
//
// 1. 최초 책 등록
// 2. 일반 책 열기
// 3. 다시 읽기(restart)
// ======================================================

export async function POST(
  request: Request
) {
  const session: any =
    await getServerSession(authOptions);

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
    // 1. 기본값 검증
    // --------------------------------------------------

    if (!drive_file_id) {
      return Response.json(
        {
          error:
            "drive_file_id가 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (!title) {
      return Response.json(
        {
          error: "title이 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (
      typeof total_episodes !==
        "number" ||
      total_episodes < 0
    ) {
      return Response.json(
        {
          error:
            "total_episodes가 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. 기존 책 확인
    // --------------------------------------------------

    const {
      data: existingBook,
      error: findBookError,
    } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq(
        "drive_file_id",
        drive_file_id
      )
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
    // 3. 책이 없는 경우
    // --------------------------------------------------

    if (!book) {
      // restart로 존재하지 않는 책을
      // 새 회차로 시작하려는 경우
      if (restart) {
        return Response.json(
          {
            error:
              "다시 읽기를 시작할 책 정보를 찾을 수 없습니다.",
          },
          { status: 404 }
        );
      }

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
          {
            error:
              bookInsertError.message,
          },
          { status: 500 }
        );
      }

      book = newBook;
    } else {
      // ------------------------------------------------
      // 기존 책 정보만 갱신
      //
      // status는 변경하지 않는다.
      // ------------------------------------------------

      const {
        data: updatedBook,
        error: updateBookError,
      } = await supabase
        .from("books")
        .update({
          title,
          total_episodes,
        })
        .eq("id", book.id)
        .eq("user_id", userId)
        .eq(
          "drive_file_id",
          drive_file_id
        )
        .select()
        .single();

      if (updateBookError) {
        console.error(
          "EXISTING BOOK UPDATE ERROR:",
          updateBookError
        );

        return Response.json(
          {
            error:
              updateBookError.message,
          },
          { status: 500 }
        );
      }

      book = updatedBook;
    }

    // --------------------------------------------------
    // 4. 기존 회차 조회
    // --------------------------------------------------

    const {
      data: existingRounds,
      error: roundsError,
    } = await supabase
      .from("reading_rounds")
      .select("*")
      .eq("user_id", userId)
      .eq("book_id", book.id)
      .order("round", {
        ascending: true,
      });

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

    let rounds =
      existingRounds ?? [];

    // --------------------------------------------------
    // 5. 최초 독서
    //
    // restart=false일 때만 1회차 생성
    // --------------------------------------------------

    if (
      rounds.length === 0 &&
      !restart
    ) {
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
          {
            error:
              roundInsertError.message,
          },
          { status: 500 }
        );
      }

      const {
        data: newProgress,
        error:
          progressInsertError,
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

      if (progressInsertError) {
        console.error(
          "READING PROGRESS INSERT ERROR:",
          progressInsertError
        );

        return Response.json(
          {
            error:
              progressInsertError.message,
          },
          { status: 500 }
        );
      }

      rounds = [newRound];

      return Response.json({
        success: true,
        data: {
          book,
          rounds,
          current_round:
            newRound,
          progress:
            newProgress,
        },
      });
    }

    // ==================================================
    // 6. 다시 읽기
    // ==================================================

    if (restart) {
      const latestRound =
        rounds.length > 0
          ? rounds[
              rounds.length - 1
            ]
          : null;

      // ------------------------------------------------
      // 이미 읽는 중인 회차가 있으면
      // 새 회차를 만들지 않는다.
      // ------------------------------------------------

      if (
        latestRound &&
        latestRound.status ===
          "reading"
      ) {
        const {
          data: existingProgress,
          error:
            existingProgressError,
        } = await supabase
          .from("reading_progress")
          .select("*")
          .eq(
            "round_id",
            latestRound.id
          )
          .maybeSingle();

        if (existingProgressError) {
          return Response.json(
            {
              error:
                existingProgressError.message,
            },
            { status: 500 }
          );
        }

        const {
          data: readingBook,
          error:
            readingBookError,
        } = await supabase
          .from("books")
          .update({
            status: "읽는 중",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", book.id)
          .eq(
            "user_id",
            userId
          )
          .eq(
            "drive_file_id",
            drive_file_id
          )
          .select()
          .single();

        if (readingBookError) {
          return Response.json(
            {
              error:
                readingBookError.message,
            },
            { status: 500 }
          );
        }

        return Response.json({
          success: true,
          data: {
            book: readingBook,
            rounds,
            current_round:
              latestRound,
            progress:
              existingProgress ??
              {
                round_id:
                  latestRound.id,
                episode: 0,
                progress: 0,
                scroll_position: 0,
              },
          },
        });
      }

      // ------------------------------------------------
      // 다음 회차 번호
      // ------------------------------------------------

      const nextRoundNumber =
        rounds.length > 0
          ? Math.max(
              ...rounds.map(
                (round) =>
                  round.round
              )
            ) + 1
          : 1;

      // ------------------------------------------------
      // 새 회차 생성
      // ------------------------------------------------

      const {
        data: newRound,
        error: newRoundError,
      } = await supabase
        .from("reading_rounds")
        .insert({
          user_id: userId,
          book_id: book.id,
          round:
            nextRoundNumber,
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
          {
            error:
              newRoundError.message,
          },
          { status: 500 }
        );
      }

      // ------------------------------------------------
      // 새 회차 진행상황
      // ------------------------------------------------

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
          {
            error:
              newProgressError.message,
          },
          { status: 500 }
        );
      }

      rounds = [
        ...rounds,
        newRound,
      ];

      // ------------------------------------------------
      // books의 현재 상태만 변경
      //
      // 과거 completed 회차는 건드리지 않는다.
      // ------------------------------------------------

      const {
        data: restartedBook,
        error:
          restartedBookError,
      } = await supabase
        .from("books")
        .update({
          status: "읽는 중",
          last_episode: 0,
          progress: 0,
          scroll_position: 0,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", book.id)
        .eq(
          "user_id",
          userId
        )
        .eq(
          "drive_file_id",
          drive_file_id
        )
        .select()
        .single();

      if (restartedBookError) {
        console.error(
          "RESTART BOOK UPDATE ERROR:",
          restartedBookError
        );

        return Response.json(
          {
            error:
              restartedBookError.message,
          },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        data: {
          book: restartedBook,
          rounds,
          current_round:
            newRound,
          progress:
            newProgress,
        },
      });
    }

    // ==================================================
    // 7. 일반적으로 책 열기
    // ==================================================

    const currentRound =
      [...rounds]
        .reverse()
        .find(
          (round) =>
            round.status ===
            "reading"
        ) ??
      rounds[
        rounds.length - 1
      ];

    if (!currentRound) {
      return Response.json(
        {
          error:
            "현재 독서 회차를 찾을 수 없습니다.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 8. 진행상황 조회
    // --------------------------------------------------

    const {
      data: progress,
      error: progressError,
    } = await supabase
      .from("reading_progress")
      .select("*")
      .eq(
        "round_id",
        currentRound.id
      )
      .maybeSingle();

    if (progressError) {
      console.error(
        "READING PROGRESS FIND ERROR:",
        progressError
      );

      return Response.json(
        {
          error:
            progressError.message,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 9. books 상태 동기화
    // --------------------------------------------------

    const bookStatus =
      currentRound.status ===
      "completed"
        ? "완독"
        : "읽는 중";

    const {
      data: finalBook,
      error: finalBookError,
    } = await supabase
      .from("books")
      .update({
        status: bookStatus,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", book.id)
      .eq(
        "user_id",
        userId
      )
      .eq(
        "drive_file_id",
        drive_file_id
      )
      .select()
      .single();

    if (finalBookError) {
      console.error(
        "BOOK STATUS SYNC ERROR:",
        finalBookError
      );

      return Response.json(
        {
          error:
            finalBookError.message,
        },
        { status: 500 }
      );
    }

    book = finalBook;

    // --------------------------------------------------
    // 10. 결과 반환
    // --------------------------------------------------

    return Response.json({
      success: true,
      data: {
        book,
        rounds,
        current_round:
          currentRound,
        progress:
          progress ?? {
            round_id:
              currentRound.id,
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

// ======================================================
// PATCH
// 읽기 진행상황 저장
// ======================================================

export async function PATCH(
  request: Request
) {
  const session: any =
    await getServerSession(authOptions);

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
      episode,
      progress,
      scroll_position,
      round_id,
      status,
    } = body;

    // --------------------------------------------------
    // 1. 기본값 검증
    // --------------------------------------------------

    if (!drive_file_id) {
      return Response.json(
        {
          error:
            "drive_file_id가 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (
      typeof episode !==
        "number" ||
      episode < 0
    ) {
      return Response.json(
        {
          error:
            "episode가 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    if (
      typeof progress !==
        "number" ||
      progress < 0 ||
      progress > 100
    ) {
      return Response.json(
        {
          error:
            "progress가 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    if (
      typeof scroll_position !==
        "number" ||
      scroll_position < 0
    ) {
      return Response.json(
        {
          error:
            "scroll_position이 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. 책 조회
    // --------------------------------------------------

    const {
      data: book,
      error: bookError,
    } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq(
        "drive_file_id",
        drive_file_id
      )
      .maybeSingle();

    if (bookError) {
      console.error(
        "PATCH BOOK FIND ERROR:",
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
            "책 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 3. 현재 회차 조회
    // --------------------------------------------------

    let currentRound: any =
      null;

    if (round_id) {
      const {
        data: requestedRound,
        error: requestedRoundError,
      } = await supabase
        .from("reading_rounds")
        .select("*")
        .eq("id", round_id)
        .eq("user_id", userId)
        .eq("book_id", book.id)
        .maybeSingle();

      if (requestedRoundError) {
        console.error(
          "REQUESTED ROUND FIND ERROR:",
          requestedRoundError
        );

        return Response.json(
          {
            error:
              requestedRoundError.message,
          },
          { status: 500 }
        );
      }

      currentRound =
        requestedRound;
    } else {
      const {
        data: rounds,
        error: roundsError,
      } = await supabase
        .from("reading_rounds")
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", book.id)
        .order("round", {
          ascending: false,
        });

      if (roundsError) {
        console.error(
          "PATCH ROUNDS FIND ERROR:",
          roundsError
        );

        return Response.json(
          {
            error:
              roundsError.message,
          },
          { status: 500 }
        );
      }

      currentRound =
        rounds?.find(
          (round) =>
            round.status ===
            "reading"
        ) ??
        rounds?.[0] ??
        null;
    }

    if (!currentRound) {
      return Response.json(
        {
          error:
            "독서 회차를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 4. 이미 완독한 회차 보호
    //
    // completed → reading으로 되돌아가지 않게 한다.
    // --------------------------------------------------

    if (
      currentRound.status ===
        "completed" &&
      status !== "completed"
    ) {
      return Response.json({
        success: true,
        data: {
          book,
          round: currentRound,
          progress: null,
        },
      });
    }

    // --------------------------------------------------
    // 5. 진행상황 저장
    // --------------------------------------------------

    const nextStatus =
      status === "completed"
        ? "completed"
        : "reading";

    const {
      data: savedProgress,
      error: progressError,
    } = await supabase
      .from("reading_progress")
      .upsert(
        {
          round_id:
            currentRound.id,
          episode,
          progress,
          scroll_position,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "round_id",
        }
      )
      .select()
      .single();

    if (progressError) {
      console.error(
        "PATCH PROGRESS ERROR:",
        progressError
      );

      return Response.json(
        {
          error:
            progressError.message,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 6. 회차 상태 변경
    // --------------------------------------------------

    let updatedRound =
      currentRound;

    if (
      nextStatus ===
      "completed"
    ) {
      const {
        data: completedRound,
        error:
          completedRoundError,
      } = await supabase
        .from("reading_rounds")
        .update({
          status: "completed",
          completed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          currentRound.id
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "book_id",
          book.id
        )
        .select()
        .single();

      if (completedRoundError) {
        console.error(
          "ROUND COMPLETE ERROR:",
          completedRoundError
        );

        return Response.json(
          {
            error:
              completedRoundError.message,
          },
          { status: 500 }
        );
      }

      updatedRound =
        completedRound;
    }

    // --------------------------------------------------
    // 7. books 테이블 동기화
    // --------------------------------------------------

    const {
      data: updatedBook,
      error: updatedBookError,
    } = await supabase
      .from("books")
      .update({
        last_episode: episode,
        progress,
        status:
          nextStatus ===
          "completed"
            ? "완독"
            : "읽는 중",
        scroll_position,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", book.id)
      .eq(
        "user_id",
        userId
      )
      .eq(
        "drive_file_id",
        drive_file_id
      )
      .select()
      .single();

    if (updatedBookError) {
      console.error(
        "PATCH BOOK UPDATE ERROR:",
        updatedBookError
      );

      return Response.json(
        {
          error:
            updatedBookError.message,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 8. 결과 반환
    // --------------------------------------------------

    return Response.json({
      success: true,
      data: {
        book: updatedBook,
        round: updatedRound,
        progress:
          savedProgress,
      },
    });
  } catch (error) {
    console.error(
      "BOOKS PATCH UNEXPECTED ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "읽기 진행상황 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
