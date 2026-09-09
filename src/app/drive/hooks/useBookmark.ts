"use client";

import {
  useCallback,
  useState,
} from "react";

type UseBookmarkParams = {
  bookId: string | null;
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

export function useBookmark({
  bookId,
  fileId,
  episode,
}: UseBookmarkParams) {
  const [bookmarked, setBookmarked] =
    useState(false);

  const [bookmarkLoading, setBookmarkLoading] =
    useState(false);

  const getBookmarkStatus =
    useCallback(
      async (
        targetFileId: string,
        targetEpisode: number
      ) => {
        try {
          const response =
            await fetch(
              `/api/bookmarks?driveFileId=${encodeURIComponent(
                targetFileId
              )}&episode=${targetEpisode}`
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              extractErrorMessage(
                data,
                "북마크 상태를 불러오지 못했습니다."
              )
            );
          }

          setBookmarked(
            !!data.bookmarked
          );

          return !!data.bookmarked;
        } catch (error) {
          console.error(
            "북마크 상태 불러오기 실패:",
            error
          );

          setBookmarked(false);

          return false;
        }
      },
      []
    );

  const toggleBookmark =
    useCallback(
      async () => {
        if (
          !fileId ||
          !bookId ||
          episode === null
        ) {
          return;
        }

        setBookmarkLoading(true);

        try {
          if (bookmarked) {
            const response =
              await fetch(
                `/api/bookmarks?driveFileId=${encodeURIComponent(
                  fileId
                )}&episode=${episode}`,
                {
                  method: "DELETE",
                }
              );

            const data =
              await response.json();

            if (!response.ok) {
              throw new Error(
                extractErrorMessage(
                  data,
                  "북마크를 삭제하지 못했습니다."
                )
              );
            }

            setBookmarked(false);
          } else {
            const response =
              await fetch(
                "/api/bookmarks",
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
                    book_id: bookId,
                    drive_file_id:
                      fileId,
                    episode,
                  }),
                }
              );

            const data =
              await response.json();

            if (!response.ok) {
              throw new Error(
                extractErrorMessage(
                  data,
                  "북마크를 저장하지 못했습니다."
                )
              );
            }

            setBookmarked(true);
          }
        } catch (error) {
          console.error(
            "북마크 처리 실패:",
            error
          );
        } finally {
          setBookmarkLoading(false);
        }
      },
      [
        fileId,
        bookId,
        episode,
        bookmarked,
      ]
    );

  return {
    bookmarked,
    bookmarkLoading,
    getBookmarkStatus,
    toggleBookmark,
  };
}