"use client";

import { useCallback } from "react";

type UseFileCloseParams = {
  selectedFile:
    | {
        id: string;
      }
    | null;

  parsedNovel:
    | {
        episodes: Array<{
          episode: number;
        }>;
      }
    | null;

  selectedEpisode:
    | {
        episode: number;
      }
    | undefined;

  roundId: string | null;

  roundStatus: string | null;

  saveScrollPosition: (
    scrollPosition: number
  ) => Promise<unknown>;
};

export function useFileClose({
  selectedFile,
  parsedNovel,
  selectedEpisode,
  roundId,
  roundStatus,
  saveScrollPosition,
}: UseFileCloseParams) {
  const closeFile = useCallback(
    async () => {
      if (
        selectedFile &&
        parsedNovel &&
        selectedEpisode &&
        roundId &&
        roundStatus !== "completed"
      ) {
        await saveScrollPosition(
          window.scrollY
        );
      }

      window.history.back();
    },
    [
      selectedFile,
      parsedNovel,
      selectedEpisode,
      roundId,
      roundStatus,
      saveScrollPosition,
    ]
  );

  return {
    closeFile,
  };
}