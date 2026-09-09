"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

export type HighlightItem = {
  id: string;
  book_id: string;
  drive_file_id: string;
  episode: number;
  text: string;
  start_offset: number;
  end_offset: number;
  created_at?: string;
};

type UseHighlightsParams = {
  fileId: string | null;
  episode: number | null;
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
        return JSON.stringify(
          errorValue
        );
      } catch {
        return fallback;
      }
    }
  }

  return fallback;
}

export function useHighlights({
  fileId,
  episode,
}: UseHighlightsParams) {
  const [highlights, setHighlights] =
    useState<HighlightItem[]>([]);

  const [highlightLoading, setHighlightLoading] =
    useState(false);

  const loadHighlights =
    useCallback(
      async (
        targetFileId: string,
        targetEpisode: number
      ) => {
        try {
          const response =
            await fetch(
              `/api/highlights?driveFileId=${encodeURIComponent(
                targetFileId
              )}&episode=${targetEpisode}`
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              extractErrorMessage(
                data,
                "하이라이트를 불러오지 못했습니다."
              )
            );
          }

          const nextHighlights =
            Array.isArray(data?.data)
              ? data.data
              : [];

          setHighlights(
            nextHighlights
          );

          return nextHighlights;
        } catch (error) {
          console.error(
            "하이라이트 불러오기 실패:",
            error
          );

          setHighlights([]);

          return [];
        }
      },
      []
    );

  const saveHighlight =
    useCallback(
      async (
        bookId: string,
        targetFileId: string,
        targetEpisode: number,
        text: string,
        startOffset: number,
        endOffset: number
      ) => {
        setHighlightLoading(true);

        try {
          const response =
            await fetch(
              "/api/highlights",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  book_id: bookId,
                  drive_file_id:
                    targetFileId,
                  episode:
                    targetEpisode,
                  text,
                  start_offset:
                    startOffset,
                  end_offset:
                    endOffset,
                }),
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              extractErrorMessage(
                data,
                "하이라이트를 저장하지 못했습니다."
              )
            );
          }

          await loadHighlights(
            targetFileId,
            targetEpisode
          );

          return true;
        } catch (error) {
          console.error(
            "하이라이트 저장 실패:",
            error
          );

          return false;
        } finally {
          setHighlightLoading(false);
        }
      },
      [loadHighlights]
    );

  useEffect(() => {
    if (
      !fileId ||
      episode === null
    ) {
      setHighlights([]);
      return;
    }

    void loadHighlights(
      fileId,
      episode
    );
  }, [
    fileId,
    episode,
    loadHighlights,
  ]);

  return {
    highlights,
    highlightLoading,
    loadHighlights,
    saveHighlight,
  };
}