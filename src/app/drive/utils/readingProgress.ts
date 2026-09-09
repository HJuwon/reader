import type { ParsedNovel } from "@/lib/parser";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

export type BookInfo = {
  id: string;
  drive_file_id: string;
  title: string;
  total_episodes: number;
  last_episode?: number;
  progress?: number;
  status?: string;
  scroll_position?: number;
};

export type ReadingRound = {
  id: string;
  user_id: string;
  book_id: string;
  round: number;
  status: "reading" | "completed";
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type ReadingProgress = {
  id: string;
  round_id: string;
  episode: number;
  progress: number;
  scroll_position: number;
  updated_at: string;
};

export type ReadingState = {
  book: BookInfo;
  round: ReadingRound;
  progress: ReadingProgress;
};

export function extractReadingError(
  data: unknown,
  fallback: string
): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data
  ) {
    const errorValue = (
      data as {
        error?: unknown;
      }
    ).error;

    if (typeof errorValue === "string") {
      return errorValue;
    }

    if (
      typeof errorValue === "object" &&
      errorValue !== null &&
      "message" in errorValue
    ) {
      const message = (
        errorValue as {
          message?: unknown;
        }
      ).message;

      if (typeof message === "string") {
        return message;
      }
    }

    if (errorValue) {
      try {
        return JSON.stringify(errorValue);
      } catch {
        return fallback;
      }
    }
  }

  return fallback;
}

export async function initializeReadingState(
  fileId: string,
  title: string,
  totalEpisodes: number
): Promise<ReadingState> {
  const response = await fetch(
    "/api/books",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        drive_file_id: fileId,
        title,
        total_episodes:
          totalEpisodes,
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      extractReadingError(
        data,
        "읽기 정보를 초기화하지 못했습니다."
      )
    );
  }

  const stateData =
    data?.data;

  const round =
    stateData?.round ??
    stateData?.current_round;

  const state: ReadingState = {
    book: stateData?.book,
    round,
    progress:
      stateData?.progress,
  };

  if (
    !state.book ||
    !state.round ||
    !state.progress
  ) {
    throw new Error(
      "읽기 정보 응답 형식이 올바르지 않습니다."
    );
  }

  return state;
}

export function calculateProgress(
  episodeIndex: number,
  totalEpisodes: number
): number {
  if (totalEpisodes <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      ((episodeIndex + 1) /
        totalEpisodes) *
        100
    )
  );
}

export function isLastEpisode(
  episodeIndex: number,
  totalEpisodes: number
): boolean {
  return (
    totalEpisodes > 0 &&
    episodeIndex ===
      totalEpisodes - 1
  );
}

export async function saveReadingProgress(
  params: {
    file: DriveItem;
    novel: ParsedNovel;
    episodeIndex: number;
    scrollPosition: number;
    roundId: string;
  }
): Promise<{
  success: boolean;
  status:
    | "reading"
    | "completed";
}> {
  const {
    file,
    novel,
    episodeIndex,
    scrollPosition,
    roundId,
  } = params;

  if (
    !roundId ||
    novel.episodes.length === 0
  ) {
    return {
      success: false,
      status: "reading",
    };
  }

  const episode =
    novel.episodes[
      episodeIndex
    ];

  if (!episode) {
    return {
      success: false,
      status: "reading",
    };
  }

  const progress =
    calculateProgress(
      episodeIndex,
      novel.episodes.length
    );

  const completed =
    isLastEpisode(
      episodeIndex,
      novel.episodes.length
    );

  const status = completed
    ? "completed"
    : "reading";

  const response =
    await fetch(
      "/api/books",
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          drive_file_id:
            file.id,
          round_id:
            roundId,
          episode:
            episode.episode,
          progress,
          status,
          scroll_position:
            Math.max(
              0,
              Math.round(
                scrollPosition
              )
            ),
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      extractReadingError(
        data,
        "읽기 진행상황을 저장하지 못했습니다."
      )
    );
  }

  return {
    success: true,
    status,
  };
}