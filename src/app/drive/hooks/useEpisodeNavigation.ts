"use client";

import { useCallback } from "react";

type Episode = {
  episode: number;
};

type UseEpisodeNavigationParams = {
  parsedNovel:
    | {
        episodes: Episode[];
      }
    | null;

  selectedEpisodeIndex: number;

  progressSaving: boolean;

  roundStatus: string | null;

  selectedFile:
    | {
        id: string;
      }
    | null;

  setSelectedEpisodeIndex: (
    index: number
  ) => void;

  setEpisodeListOpen: (
    open: boolean
  ) => void;

  setChromeVisible: (
    visible: boolean
  ) => void;

  setBodySearch: (
    value: string
  ) => void;

  setBodySearchIndex: (
    index: number
  ) => void;

  saveProgress: (
    episodeIndex: number,
    scrollPosition: number
  ) => Promise<unknown>;

  getBookmarkStatus: (
    fileId: string,
    episode: number
  ) => Promise<unknown>;

  scrollPositionRef: {
    current: number;
  };

  restoreScrollPositionRef: {
    current: number;
  };
};

export function useEpisodeNavigation({
  parsedNovel,
  selectedEpisodeIndex,
  progressSaving,
  roundStatus,
  selectedFile,
  setSelectedEpisodeIndex,
  setEpisodeListOpen,
  setChromeVisible,
  setBodySearch,
  setBodySearchIndex,
  saveProgress,
  getBookmarkStatus,
  scrollPositionRef,
  restoreScrollPositionRef,
}: UseEpisodeNavigationParams) {
  /*
   * 회차 변경
   */
  const changeEpisode = useCallback(
    async (index: number) => {
      if (!parsedNovel) {
        return;
      }

      if (progressSaving) {
        return;
      }

      if (
        index < 0 ||
        index >= parsedNovel.episodes.length
      ) {
        return;
      }

      if (
        index === selectedEpisodeIndex
      ) {
        setEpisodeListOpen(false);
        return;
      }

      setChromeVisible(true);

      const currentScrollPosition =
        Math.max(
          0,
          Math.round(window.scrollY)
        );

      if (
        roundStatus !== "completed"
      ) {
        await saveProgress(
          selectedEpisodeIndex,
          currentScrollPosition
        );
      }

      setSelectedEpisodeIndex(index);

      setEpisodeListOpen(false);

      restoreScrollPositionRef.current = 0;
      scrollPositionRef.current = 0;

      setBodySearch("");
      setBodySearchIndex(0);

      window.scrollTo({
        top: 0,
        behavior: "auto",
      });

      if (
        roundStatus !== "completed"
      ) {
        await saveProgress(
          index,
          0
        );
      }

      const episode =
        parsedNovel.episodes[index];

      if (
        episode &&
        selectedFile
      ) {
        await getBookmarkStatus(
          selectedFile.id,
          episode.episode
        );
      }
    },
    [
      parsedNovel,
      progressSaving,
      selectedEpisodeIndex,
      roundStatus,
      selectedFile,
      setSelectedEpisodeIndex,
      setEpisodeListOpen,
      setChromeVisible,
      setBodySearch,
      setBodySearchIndex,
      saveProgress,
      getBookmarkStatus,
      scrollPositionRef,
      restoreScrollPositionRef,
    ]
  );

  /*
   * 이전화
   */
  const goToPrevEpisode = useCallback(
    async () => {
      if (
        !parsedNovel ||
        progressSaving
      ) {
        return;
      }

      const nextIndex =
        Math.max(
          0,
          selectedEpisodeIndex - 1
        );

      if (
        nextIndex ===
        selectedEpisodeIndex
      ) {
        return;
      }

      await changeEpisode(
        nextIndex
      );
    },
    [
      parsedNovel,
      progressSaving,
      selectedEpisodeIndex,
      changeEpisode,
    ]
  );

  /*
   * 다음화
   */
  const goToNextEpisode = useCallback(
    async () => {
      if (
        !parsedNovel ||
        progressSaving
      ) {
        return;
      }

      const nextIndex =
        Math.min(
          parsedNovel.episodes.length - 1,
          selectedEpisodeIndex + 1
        );

      if (
        nextIndex ===
        selectedEpisodeIndex
      ) {
        return;
      }

      await changeEpisode(
        nextIndex
      );
    },
    [
      parsedNovel,
      progressSaving,
      selectedEpisodeIndex,
      changeEpisode,
    ]
  );

  return {
    changeEpisode,
    goToPrevEpisode,
    goToNextEpisode,
  };
}
