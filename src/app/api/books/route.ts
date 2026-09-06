import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

// ======================================================
// GET
// 소설 목록 조회
// ======================================================

export async function GET() {
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
    // --------------------------------------------------
    // 1. 책 + 회차 병렬 조회
    // --------------------------------------------------

    const [booksResult, roundsResult] =
      await Promise.all([
        supabase
          .from("books")
          .select(
            "id,user_id,drive_file_id,title,total_episodes,last_episode,progress,status,series_status,created_at,updated_at,scroll_position"
          )
          .eq("user_id", userId)
          .order("updated_at", {
            ascending: false,
          }),

        supabase
          .from("reading_rounds")
          .select(
            "id,user_id,drive_file_id,title,total_episodes,last_episode,progress,status,series_status,created_at,updated_at,scroll_position"
          )
          .eq("user_id", userId)
          .order("round", {
            ascending: true,
          }),
      ]);

    const {
      data: books,
      error: booksError,
    } = booksResult;

    if (booksError) {
      console.error(
        "BOOKS GET ERROR:",
        booksError
      );

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
          {
            error:
              progressError.message,
          },
          { status: 500 }
        );
      }

      progressList = progress ?? [];
    }

    // --------------------------------------------------
    // 3. Map 생성
    // --------------------------------------------------

    const roundsByBook = new Map<
      string,
      any[]
    >();

    for (const round of roundList) {
      const list =
        roundsByBook.get(
          round.book_id
        ) ?? [];

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
      const rawBookRounds =
        roundsByBook.get(book.id) ?? [];

      // 각 회독(round)에 해당 회독의 진행상황(episode/progress)을 붙여준다.
      const bookRounds = rawBookRounds.map(
        (round) => {
          const roundProgress =
            progressByRound.get(round.id) ??
            null;

          return {
            ...round,
            episode:
              roundProgress?.episode ?? 0,
            progress:
              roundProgress?.progress ?? 0,
          };
        }
      );

      const currentRound =
        [...bookRounds]
          .reverse()
          .find(
            (round) =>
              round.status ===
              "reading"
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
              round.status ===
              "completed"
          ).length,

        current_round:
          currentRound?.round ??
          null,

        current_round_id:
          currentRound?.id ??
          null,

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
      .select(
        "id,user_id,drive_file_id,title,total_episodes,last_episode,progress,status,series_status,created_at,updated_at,scroll_position"
      )
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
        {
          error:
            findBookError.message,
        },
        { status: 500 }
      );
    }

    let book = existingBook;

    // --------------------------------------------------
    // 3. 책이 없는 경우
    // --------------------------------------------------

    if (!book) {
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

      if (!newBook) {
        return Response.json(
          {
            error:
              "책 정보를 생성했지만 책 데이터를 가져오지 못했습니다.",
          },
          { status: 500 }
        );
      }

      book = newBook;
    } else {
      // ------------------------------------------------
      // 기존 책 정보만 갱신
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

      if (!updatedBook) {
        return Response.json(
          {
            error:
              "책 정보를 업데이트했지만 책 데이터를 가져오지 못했습니다.",
          },
          { status: 500 }
        );
      }

      book = updatedBook;
    }

    // --------------------------------------------------
    // TypeScript null narrowing 보장
    // --------------------------------------------------

    if (!book) {
      return Response.json(
        {
          error:
            "책 정보를 확인할 수 없습니다.",
        },
        { status: 500 }
      );
    }

    // ==================================================
    // 4. 기존 회차 조회
    // ==================================================

    const {
      data: existingRounds,
      error: roundsError,
    } = await supabase
      .from("reading_rounds")
      .select(
        "id,user_id,book_id,round,status,started_at,completed_at,created_at"
      )
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
        {
          error:
            roundsError.message,
        },
        { status: 500 }
      );
    }

    let rounds =
      existingRounds ?? [];

    // ==================================================
    // 5. 최초 독서
    // ==================================================

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

      if (!newRound) {
        return Response.json(
          {
            error:
              "독서 회차를 생성했지만 회차 데이터를 가져오지 못했습니다.",
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

      if (!newProgress) {
        return Response.json(
          {
            error:
              "독서 진행상황을 생성했지만 데이터를 가져오지 못했습니다.",
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
        const [
          progressResult,
          bookResult,
        ] = await Promise.all([
          supabase
            .from("reading_progress")
            .select(
              "id,round_id,episode,progress,scroll_position,updated_at"
            )
            .eq(
              "round_id",
              latestRound.id
            )
            .maybeSingle(),

          supabase
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
            .single(),
        ]);

        if (progressResult.error) {
          console.error(
            "EXISTING PROGRESS FIND ERROR:",
            progressResult.error
          );

          return Response.json(
            {
              error:
                progressResult.error.message,
            },
            { status: 500 }
          );
        }

        if (bookResult.error) {
          console.error(
            "READING BOOK UPDATE ERROR:",
            bookResult.error
          );

          return Response.json(
            {
              error:
                bookResult.error.message,
            },
            { status: 500 }
          );
        }

        if (!bookResult.data) {
          return Response.json(
            {
              error:
                "책 상태를 업데이트했지만 데이터를 가져오지 못했습니다.",
            },
            { status: 500 }
          );
        }

        return Response.json({
          success: true,
          data: {
            book:
              bookResult.data,
            rounds,
            current_round:
              latestRound,
            progress:
              progressResult.data ??
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
          ? rounds[
              rounds.length - 1
            ].round + 1
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

      if (!newRound) {
        return Response.json(
          {
            error:
              "새 독서 회차를 생성했지만 회차 데이터를 가져오지 못했습니다.",
          },
          { status: 500 }
        );
      }

      // ------------------------------------------------
      // 진행상황 + books 업데이트 병렬 처리
      // ------------------------------------------------

      const now =
        new Date().toISOString();

      const [
        progressResult,
        bookResult,
      ] = await Promise.all([
        supabase
          .from("reading_progress")
          .insert({
            round_id:
              newRound.id,
            episode: 0,
            progress: 0,
            scroll_position: 0,
          })
          .select()
          .single(),

        supabase
          .from("books")
          .update({
            status: "읽는 중",
            last_episode: 0,
            progress: 0,
            scroll_position: 0,
            updated_at: now,
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
          .single(),
      ]);

      if (progressResult.error) {
        console.error(
          "NEW READING PROGRESS ERROR:",
          progressResult.error
        );

        return Response.json(
          {
            error:
              progressResult.error.message,
          },
          { status: 500 }
        );
      }

      if (!progressResult.data) {
        return Response.json(
          {
            error:
              "진행상황을 생성했지만 데이터를 가져오지 못했습니다.",
          },
          { status: 500 }
        );
      }

      if (bookResult.error) {
        console.error(
          "RESTART BOOK UPDATE ERROR:",
          bookResult.error
        );

        return Response.json(
          {
            error:
              bookResult.error.message,
          },
          { status: 500 }
        );
      }

      if (!bookResult.data) {
        return Response.json(
          {
            error:
              "책 상태를 업데이트했지만 데이터를 가져오지 못했습니다.",
          },
          { status: 500 }
        );
      }

      rounds = [
        ...rounds,
        newRound,
      ];

      return Response.json({
        success: true,
        data: {
          book:
            bookResult.data,
          rounds,
          current_round:
            newRound,
          progress:
            progressResult.data,
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
      .select(
        "id,round_id,episode,progress,scroll_position,updated_at"
      )
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
    // 9. 결과 반환
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
      typeof episode !== "number" ||
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
      typeof progress !== "number" ||
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
      data: foundBook,
      error: bookError,
    } = await supabase
      .from("books")
      .select(
        "id,user_id,drive_file_id,title,total_episodes,last_episode,progress,status,series_status,created_at,updated_at,scroll_position""
      )
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

    if (!foundBook) {
      return Response.json(
        {
          error:
            "책 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    // null이 아님을 TypeScript에 명확하게 전달
    const book = foundBook;

    // --------------------------------------------------
    // 3. 회차 조회
    // --------------------------------------------------

    let currentRound: any =
      null;

    if (round_id) {
      const {
        data: requestedRound,
        error: requestedRoundError,
      } = await supabase
        .from("reading_rounds")
        .select(
          "id,user_id,book_id,round,status,started_at,completed_at,created_at"
        )
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
        .select(
          "id,user_id,book_id,round,status,started_at,completed_at,created_at"
        )
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

    const now =
      new Date().toISOString();

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
          updated_at: now,
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

    if (!savedProgress) {
      return Response.json(
        {
          error:
            "진행상황을 저장했지만 저장된 데이터를 가져오지 못했습니다.",
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
      nextStatus === "completed"
    ) {
      const {
        data: completedRound,
        error:
          completedRoundError,
      } = await supabase
        .from("reading_rounds")
        .update({
          status: "completed",
          completed_at: now,
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

      if (!completedRound) {
        return Response.json(
          {
            error:
              "회차를 완독 처리했지만 데이터를 가져오지 못했습니다.",
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
        updated_at: now,
      })
      .eq("id", book.id)
      .eq("user_id", userId)
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

    if (!updatedBook) {
      return Response.json(
        {
          error:
            "책 정보를 업데이트했지만 데이터를 가져오지 못했습니다.",
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

