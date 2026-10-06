"use client";

import {
  useCallback,
  useEffect,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";

type UseHighlightSelectionParams = {
  contentRef: RefObject<HTMLDivElement | null>;

  selectedEpisodeIndex: number;

  selectedEpisode:
    | {
        content: string;
        episode: number;
      }
    | undefined;

  highlights: Array<{
    id: string;
    start_offset: number | null;
    end_offset: number | null;
  }>;

  highlightId: string | null;

  saveHighlightApi: (
    bookId: string,
    fileId: string,
    episode: number,
    text: string,
    startOffset: number,
    endOffset: number
  ) => Promise<boolean>;

  bookId: string | null;

  fileId: string | null;

  scrollPositionRef: MutableRefObject<number>;
};

export function useHighlightSelection({
  contentRef,
  selectedEpisodeIndex,
  selectedEpisode,
  highlights,
  highlightId,
  saveHighlightApi,
  bookId,
  fileId,
  scrollPositionRef,
}: UseHighlightSelectionParams) {
  const [
    selectedTextForHighlight,
    setSelectedTextForHighlight,
  ] = useState("");

  const [
    selectedHighlightRange,
    setSelectedHighlightRange,
  ] = useState<{
    startOffset: number;
    endOffset: number;
  } | null>(null);

  const [
    showHighlightButton,
    setShowHighlightButton,
  ] = useState(false);

  /*
   * 현재 선택 영역 정보
   */
  const getSelectionData = useCallback(() => {
    if (!contentRef.current) {
      return null;
    }

    const selection = window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      return null;
    }

    const selectedText =
      selection.toString().trim();

    if (!selectedText) {
      return null;
    }

    const range =
      selection.getRangeAt(0);

    if (
      !contentRef.current.contains(
        range.commonAncestorContainer
      )
    ) {
      return null;
    }

    const startRange =
      document.createRange();

    startRange.selectNodeContents(
      contentRef.current
    );

    startRange.setEnd(
      range.startContainer,
      range.startOffset
    );

    const startOffset =
      startRange.toString().length;

    const endRange =
      document.createRange();

    endRange.selectNodeContents(
      contentRef.current
    );

    endRange.setEnd(
      range.endContainer,
      range.endOffset
    );

    const endOffset =
      endRange.toString().length;

    if (endOffset <= startOffset) {
      return null;
    }

    return {
      text: selectedText,
      startOffset,
      endOffset,
    };
  }, [contentRef]);

  /*
   * 하이라이트 저장
   */
  const saveHighlight = useCallback(
    async (
      text: string,
      startOffset: number,
      endOffset: number
    ) => {
      if (
        !fileId ||
        !bookId ||
        !selectedEpisode
      ) {
        return;
      }

      const success =
        await saveHighlightApi(
          bookId,
          fileId,
          selectedEpisode.episode,
          text,
          startOffset,
          endOffset
        );

      if (!success) {
        return;
      }

      window
        .getSelection()
        ?.removeAllRanges();

      setShowHighlightButton(false);
      setSelectedTextForHighlight("");
      setSelectedHighlightRange(null);
    },
    [
      fileId,
      bookId,
      selectedEpisode,
      saveHighlightApi,
    ]
  );

  /*
   * 텍스트 선택
   */
  const handleTextSelection =
    useCallback(() => {
      window.setTimeout(() => {
        const selectionData =
          getSelectionData();

        if (!selectionData) {
          if (window.innerWidth < 768) {
            setShowHighlightButton(false);
            setSelectedTextForHighlight("");
            setSelectedHighlightRange(null);
          }

          return;
        }

        if (window.innerWidth < 768) {
          setSelectedTextForHighlight(
            selectionData.text
          );

          setSelectedHighlightRange({
            startOffset:
              selectionData.startOffset,
            endOffset:
              selectionData.endOffset,
          });

          setShowHighlightButton(true);

          return;
        }

        void saveHighlight(
          selectionData.text,
          selectionData.startOffset,
          selectionData.endOffset
        );
      }, 50);
    }, [
      getSelectionData,
      saveHighlight,
    ]);

  /*
   * 모바일 하이라이트 저장
   */
  const savePendingHighlight =
    useCallback(async () => {
      if (
        !selectedTextForHighlight ||
        !selectedHighlightRange
      ) {
        return;
      }

      await saveHighlight(
        selectedTextForHighlight,
        selectedHighlightRange.startOffset,
        selectedHighlightRange.endOffset
      );
    }, [
      selectedTextForHighlight,
      selectedHighlightRange,
      saveHighlight,
    ]);

  /*
   * 모바일: 선택 핸들 드래그 등 선택 범위 변경 감지
   * (핸들은 네이티브 UI라 touchend가 본문에 오지 않음)
   */
  useEffect(() => {
    let timer: number | undefined;

    const handleSelectionChange = () => {
      if (window.innerWidth >= 768) {
        return;
      }

      window.clearTimeout(timer);

      timer = window.setTimeout(() => {
        const data = getSelectionData();

        if (!data) {
          setShowHighlightButton(false);
          setSelectedTextForHighlight("");
          setSelectedHighlightRange(null);
          return;
        }

        setSelectedTextForHighlight(data.text);
        setSelectedHighlightRange({
          startOffset: data.startOffset,
          endOffset: data.endOffset,
        });
        setShowHighlightButton(true);
      }, 150);
    };

    document.addEventListener(
      "selectionchange",
      handleSelectionChange
    );

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener(
        "selectionchange",
        handleSelectionChange
      );
    };
  }, [getSelectionData]);

  /*
   * 회차가 바뀌면 선택 UI 초기화
   */
  useEffect(() => {
    setShowHighlightButton(false);
    setSelectedTextForHighlight("");
    setSelectedHighlightRange(null);
  }, [selectedEpisodeIndex]);

  /*
   * highlightId가 있으면 해당 하이라이트 위치로 이동
   */
  useEffect(() => {
    if (!highlightId) {
      return;
    }

    if (!selectedEpisode) {
      return;
    }

    if (highlights.length === 0) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const findAndScroll = () => {
      if (cancelled) {
        return;
      }

      attempts += 1;

      const target =
        document.querySelector(
          `[data-highlight-id="${highlightId}"]`
        );

      if (!target) {
        if (attempts < 30) {
          window.setTimeout(
            findAndScroll,
            100
          );
        }

        return;
      }

      window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        const rect =
          target.getBoundingClientRect();

        const targetTop =
          window.scrollY +
          rect.top -
          window.innerHeight / 2 +
          rect.height / 2;

        scrollPositionRef.current =
          Math.max(0, targetTop);

        window.scrollTo({
          top: Math.max(
            0,
            targetTop
          ),
          behavior: "smooth",
        });
      });
    };

    const timer =
      window.setTimeout(
        findAndScroll,
        200
      );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    highlightId,
    selectedEpisodeIndex,
    selectedEpisode,
    highlights,
    scrollPositionRef,
  ]);

  return {
    selectedTextForHighlight,
    selectedHighlightRange,
    showHighlightButton,

    handleTextSelection,
    savePendingHighlight,
  };
}
