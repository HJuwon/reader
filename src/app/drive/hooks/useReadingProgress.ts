"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ParsedNovel } from "@/lib/parser";

type ReadingStatus = "reading" | "completed";

type BookInfo = {
  id: string;
  drive_file_id: string;
  title: string;
  total_episodes: number;
  last_episode?: number;
  progress?: number;
  status?: string;
  scroll_position?: number;
};

type ReadingRound = {
  id: string;
  user_id: string;
  book_id: string;
  round: number;
  status: ReadingStatus;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

type ReadingProgress = {
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

type ReadingFile = {
  id: string;
};

type UseReadingProgressParams = {
  selectedFile: ReadingFile | null;
  parsedNovel: ParsedNovel | null;
  selectedEpisode: ParsedNovel["episodes"][number] | undefined;
  selectedEpisodeIndex: number;
};

function extractErrorMessage(
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

export function useReadingProgress({
  selectedFile,
  parsedNovel,
  selectedEpisode,
  selectedEpisodeIndex,
}: UseReadingProgressParams) {
  const [progressSaving, setProgressSaving] =
    useState(false);

  const [bookId, setBookId] =
    useState<string | null>(null);

  const [roundId, setRoundId] =
    useState<string | null>(null);

  const [roundStatus, setRoundStatus] =
    useState<ReadingStatus>("reading");

  const scrollPositionRef =
    useRef(0);

  const scrollSaveTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const restoreScrollPositionRef =
    useRef(0);

  const skipScrollRestoreRef =
    useRef(false);

  const initializeReadingState =
    useCallback(
      async (
        fileId: string,
        title: string,
        totalEpisodes: number
      ): Promise<ReadingState | null> => {
        try {
          const response =
            await fetch("/api/books", {
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
            });

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              extractErrorMessage(
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
            console.error(
              "읽기 상태 응답:",
              data
            );

            throw new Error(
              "읽기 정보 응답 형식이 올바르지 않습니다."
            );
          }

          setBookId(
            state.book.id
          );

          setRoundId(
            state.round.id
          );

          setRoundStatus(
            state.round.status
          );

          return state;
        } catch (error) {
          console.error(
            "읽기 정보 초기화 실패:",
            error
          );

          throw error;
        }
      },
      []
    );

  const saveProgress =
    useCallback(
      async (
        episodeIndex: number,
        scrollPosition = 0,
        targetRoundId?: string | null,
        context?: {
          file?: ReadingFile;
          novel?: ParsedNovel;
        }
      ) => {
        const activeRoundId =
          targetRoundId ?? roundId;

        const activeFile =
          context?.file ??
          selectedFile;

        const activeNovel =
          context?.novel ??
          parsedNovel;

        if (
          !activeFile ||
          !activeNovel ||
          !activeRoundId
        ) {
          return false;
        }

        if (
          roundStatus === "completed" &&
          !targetRoundId
        ) {
          return false;
        }

        if (
          activeNovel.episodes.length ===
          0
        ) {
          return false;
        }

        const episode =
          activeNovel.episodes[
            episodeIndex
          ];

        if (!episode) {
          return false;
        }

        const totalEpisodes =
          activeNovel.episodes.length;

        const progress =
          Math.min(
            100,
            Math.round(
              ((episodeIndex + 1) /
                totalEpisodes) *
                100
            )
          );

        const isCompleted =
          episodeIndex ===
          totalEpisodes - 1;

        setProgressSaving(true);

        try {
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
                    activeFile.id,
                  round_id:
                    activeRoundId,
                  episode:
                    episode.episode,
                  progress,
                  status:
                    isCompleted
                      ? "completed"
                      : "reading",
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
              extractErrorMessage(
                data,
                "읽기 진행상황을 저장하지 못했습니다."
              )
            );
          }

          setRoundStatus(
            isCompleted
              ? "completed"
              : "reading"
          );

          return true;
        } catch (error) {
          console.error(
            "읽기 진행상황 저장 실패:",
            error
          );

          return false;
        } finally {
          setProgressSaving(false);
        }
      },
      [
        roundId,
        selectedFile,
        parsedNovel,
        roundStatus,
      ]
    );

  const saveScrollPosition =
    useCallback(
      async (
        position?: number
      ) => {
        if (
          !selectedFile ||
          !parsedNovel ||
          !selectedEpisode ||
          !roundId
        ) {
          return;
        }

        if (
          roundStatus === "completed"
        ) {
          return;
        }

        const currentPosition =
          Math.max(
            0,
            Math.round(
              position ??
                window.scrollY
            )
          );

        scrollPositionRef.current =
          currentPosition;

        const totalEpisodes =
          parsedNovel.episodes.length;

        const progress =
          Math.min(
            100,
            Math.round(
              ((selectedEpisodeIndex +
                1) /
                totalEpisodes) *
                100
            )
          );

        const isCompleted =
          selectedEpisodeIndex ===
          totalEpisodes - 1;

        try {
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
                    selectedFile.id,
                  round_id:
                    roundId,
                  episode:
                    selectedEpisode.episode,
                  progress,
                  scroll_position:
                    currentPosition,
                  status:
                    isCompleted
                      ? "completed"
                      : "reading",
                }),
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              extractErrorMessage(
                data,
                "읽기 위치를 저장하지 못했습니다."
              )
            );
          }

          setRoundStatus(
            isCompleted
              ? "completed"
              : "reading"
          );
        } catch (error) {
          console.error(
            "스크롤 위치 저장 실패:",
            error
          );
        }
      },
      [
        selectedFile,
        parsedNovel,
        selectedEpisode,
        selectedEpisodeIndex,
        roundId,
        roundStatus,
      ]
    );

  useEffect(() => {
    if (
      !parsedNovel ||
      !selectedEpisode
    ) {
      return;
    }

    if (
      skipScrollRestoreRef.current
    ) {
      skipScrollRestoreRef.current =
        false;

      return;
    }

    const savedPosition =
      restoreScrollPositionRef.current;

    if (
      !Number.isFinite(
        savedPosition
      ) ||
      savedPosition <= 0
    ) {
      window.scrollTo({
        top: 0,
        behavior: "auto",
      });

      scrollPositionRef.current =
        0;

      return;
    }

    let cancelled = false;
    let attempts = 0;

    const restore = () => {
      if (cancelled) {
        return;
      }

      attempts += 1;

      const maxScroll =
        document.documentElement
          .scrollHeight -
        window.innerHeight;

      if (
        maxScroll <= 0 &&
        attempts < 30
      ) {
        window.setTimeout(
          restore,
          100
        );

        return;
      }

      const targetPosition =
        Math.min(
          savedPosition,
          Math.max(
            0,
            document.documentElement
              .scrollHeight -
              window.innerHeight
          )
        );

      window.scrollTo({
        top: targetPosition,
        behavior: "auto",
      });

      scrollPositionRef.current =
        targetPosition;
    };

    const timer =
      window.setTimeout(
        restore,
        100
      );

    return () => {
      cancelled = true;

      window.clearTimeout(
        timer
      );
    };
  }, [
    parsedNovel,
    selectedEpisodeIndex,
    selectedEpisode,
  ]);

  useEffect(() => {
    if (
      !selectedFile ||
      !parsedNovel ||
      !selectedEpisode ||
      !roundId
    ) {
      return;
    }

    function handleScroll() {
      const position =
        window.scrollY;

      scrollPositionRef.current =
        position;

      if (
        scrollSaveTimerRef.current
      ) {
        clearTimeout(
          scrollSaveTimerRef.current
        );
      }

      scrollSaveTimerRef.current =
        setTimeout(() => {
          void saveScrollPosition(
            position
          );
        }, 1000);
    }

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );

      if (
        scrollSaveTimerRef.current
      ) {
        clearTimeout(
          scrollSaveTimerRef.current
        );

        scrollSaveTimerRef.current =
          null;
      }
    };
  }, [
    selectedFile,
    parsedNovel,
    selectedEpisode,
    selectedEpisodeIndex,
    roundId,
    roundStatus,
    saveScrollPosition,
  ]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (
        !selectedFile ||
        !parsedNovel ||
        !selectedEpisode ||
        !roundId
      ) {
        return;
      }

      if (
        roundStatus === "completed"
      ) {
        return;
      }

      const position =
        Math.max(
          0,
          Math.round(
            window.scrollY
          )
        );

      const totalEpisodes =
        parsedNovel.episodes.length;

      const progress =
        Math.min(
          100,
          Math.round(
            ((selectedEpisodeIndex +
              1) /
              totalEpisodes) *
              100
          )
        );

      const isCompleted =
        selectedEpisodeIndex ===
        totalEpisodes - 1;

      const payload =
        JSON.stringify({
          drive_file_id:
            selectedFile.id,
          round_id:
            roundId,
          episode:
            selectedEpisode.episode,
          progress,
          status:
            isCompleted
              ? "completed"
              : "reading",
          scroll_position:
            position,
        });

      fetch(
        "/api/books",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: payload,
          keepalive: true,
        }
      ).catch(() => {
        // 종료 중 오류는 무시
      });
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [
    selectedFile,
    parsedNovel,
    selectedEpisode,
    selectedEpisodeIndex,
    roundId,
    roundStatus,
  ]);

  return {
    bookId,
    roundId,
    roundStatus,
    progressSaving,
    scrollPositionRef,
    restoreScrollPositionRef,
    skipScrollRestoreRef,
    initializeReadingState,
    saveProgress,
    saveScrollPosition,
  };
}