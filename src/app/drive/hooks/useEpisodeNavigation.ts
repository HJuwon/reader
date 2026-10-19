"use client";

import { useCallback, useRef } from "react";

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

  /** 더 이상 쓰지 않지만 호출부 호환을 위해 남겨 둔다 */
  progressSaving?: boolean;

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
   * 읽기 진행 저장은 화면 전환을 기다리게 하지 않고 뒤에서 순서대로 처리한다.
   * (큐로 이어 붙여서 저장 순서가 뒤바뀌지 않게 한다)
   */
  const saveQueueRef = useRef<Promise<unknown>>(
    Promise.resolve()
  );

  const enqueue = useCallback(
    (task: () => Promise<unknown>) => {
      saveQueueRef.current = saveQueueRef.current
        .then(task)
        .catch(() => undefined);
    },
    []
  );

  /*
   * 회차 변경
   */
  const changeEpisode = useCallback(
    async (index: number) => {
      if (!parsedNovel) {
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

      // 화면 전환이 먼저. 저장은 뒤에서 처리한다.
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
        const fromIndex = selectedEpisodeIndex;
        const fromScroll = currentScrollPosition;

        // 떠나는 화의 위치 → 새 화 위치 순서로 저장
        enqueue(() =>
          saveProgress(fromIndex, fromScroll)
        );
        enqueue(() => saveProgress(index, 0));
      }

      const episode =
        parsedNovel.episodes[index];

      if (
        episode &&
        selectedFile
      ) {
        void getBookmarkStatus(
          selectedFile.id,
          episode.episode
        );
      }
    },
    [
      parsedNovel,
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
      enqueue,
    ]
  );

  /*
   * 이전화
   */
  const goToPrevEpisode = useCallback(
    async () => {
      if (!parsedNovel) {
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
      selectedEpisodeIndex,
      changeEpisode,
    ]
  );

  /*
   * 다음화
   */
  const goToNextEpisode = useCallback(
    async () => {
      if (!parsedNovel) {
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
