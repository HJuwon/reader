"use client";

import { parseNovel, type ParsedNovel } from "@/lib/parser";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Search,
  Settings,
  X,
} from "lucide-react";

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

type HighlightItem = {
  id: string;
  book_id: string;
  drive_file_id: string;
  episode: number;
  text: string;
  start_offset: number | null;
  end_offset: number | null;
  created_at: string;
};

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
  status: "reading" | "completed";
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

type ReadingState = {
  book: BookInfo;
  round: ReadingRound;
  progress: ReadingProgress;
};

const SERIF =
  "'Noto Serif KR', 'Nanum Myeongjo', ui-serif, Georgia, serif";

type ThemeKey =
  | "ivory"
  | "white"
  | "sage"
  | "gray"
  | "dark";

type ThemeConfig = {
  label: string;
  bg: string;
  accent: string;
  text: string;
  title: string;
  muted: string;
  divider: string;
  swatch: string;
};

const THEMES: Record<ThemeKey, ThemeConfig> = {
  ivory: {
    label: "아이보리",
    bg: "#fafaf8",
    accent: "#b08d5f",
    text: "#45453f",
    title: "#1e1e1c",
    muted: "#b0b0a4",
    divider: "#eeeee7",
    swatch: "#faf6ee",
  },

  white: {
    label: "흰색",
    bg: "#ffffff",
    accent: "#8a8a7e",
    text: "#3a3a3a",
    title: "#1a1a1a",
    muted: "#9a9a9a",
    divider: "#ececec",
    swatch: "#ffffff",
  },

  sage: {
    label: "세이지",
    bg: "#f4f6f0",
    accent: "#7a8f5f",
    text: "#465239",
    title: "#2e3a24",
    muted: "#93a183",
    divider: "#e2e6da",
    swatch: "#eef2e6",
  },

  gray: {
    label: "그레이",
    bg: "#f5f5f3",
    accent: "#8a8a80",
    text: "#4a4a44",
    title: "#2a2a26",
    muted: "#a3a39a",
    divider: "#e6e6e2",
    swatch: "#ebebe7",
  },

  dark: {
    label: "다크",
    bg: "#1c1c1b",
    accent: "#c7a97a",
    text: "#d8d8d2",
    title: "#f1f1ec",
    muted: "#8f8f88",
    divider: "#333330",
    swatch: "#1c1c1b",
  },
};

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 22;
const DEFAULT_FONT_SIZE = 16;
const SETTINGS_KEY = "novel-reader-settings";

export default function DriveBrowser() {
  const searchParams = useSearchParams();

  const highlightId =
    searchParams.get("highlightId");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState<DriveItem | null>(null);

  const [fileContent, setFileContent] =
    useState("");

  const [parsedNovel, setParsedNovel] =
    useState<ParsedNovel | null>(null);

  const [selectedEpisodeIndex, setSelectedEpisodeIndex] =
    useState(0);

  const [progressSaving, setProgressSaving] =
    useState(false);

  const [bookmarked, setBookmarked] =
    useState(false);

  const [bookmarkLoading, setBookmarkLoading] =
    useState(false);

  const [bookId, setBookId] =
    useState<string | null>(null);

  const [roundId, setRoundId] =
    useState<string | null>(null);

  const [roundStatus, setRoundStatus] =
    useState<"reading" | "completed">(
      "reading"
    );

  const [themeKey, setThemeKey] =
    useState<ThemeKey>("ivory");

  const [fontSize, setFontSize] =
    useState(DEFAULT_FONT_SIZE);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [highlightLoading, setHighlightLoading] =
    useState(false);

  const [highlights, setHighlights] =
    useState<HighlightItem[]>([]);

  const [episodeSearch, setEpisodeSearch] =
    useState("");

  const [episodeListOpen, setEpisodeListOpen] =
    useState(false);

  const [bodySearch, setBodySearch] =
    useState("");

  const [bodySearchIndex, setBodySearchIndex] =
    useState(0);

  const [bodySearchOpen, setBodySearchOpen] =
    useState(false);

  const [selectedTextForHighlight, setSelectedTextForHighlight] =
    useState("");

  const [selectedHighlightRange, setSelectedHighlightRange] =
    useState<{
      startOffset: number;
      endOffset: number;
    } | null>(null);

  const [showHighlightButton, setShowHighlightButton] =
    useState(false);

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

  const contentRef =
    useRef<HTMLDivElement | null>(null);

  const mobileEpisodeListRef =
    useRef<HTMLDivElement | null>(null);

  const theme = THEMES[themeKey];

  const selectedEpisode =
    parsedNovel?.episodes[
      selectedEpisodeIndex
    ];

  const filteredEpisodes =
    parsedNovel?.episodes.filter(
      (episode) => {
        const keyword =
          episodeSearch.trim().toLowerCase();

        if (!keyword) {
          return true;
        }

        return (
          String(episode.episode)
            .toLowerCase()
            .includes(keyword) ||
          episode.title
            .toLowerCase()
            .includes(keyword)
        );
      }
    ) || [];

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          SETTINGS_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(saved);

      if (
        parsed.themeKey &&
        THEMES[
          parsed.themeKey as ThemeKey
        ]
      ) {
        setThemeKey(
          parsed.themeKey
        );
      }

      if (
        typeof parsed.fontSize ===
        "number"
      ) {
        setFontSize(
          Math.min(
            MAX_FONT_SIZE,
            Math.max(
              MIN_FONT_SIZE,
              parsed.fontSize
            )
          )
        );
      }
    } catch {
      // 기본값 사용
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          themeKey,
          fontSize,
        })
      );
    } catch {
      // 무시
    }
  }, [
    themeKey,
    fontSize,
  ]);

  useEffect(() => {
    setBodySearchIndex(0);
  }, [
    bodySearch,
    selectedEpisodeIndex,
  ]);

  useEffect(() => {
    setShowHighlightButton(false);
    setSelectedTextForHighlight("");
    setSelectedHighlightRange(null);
  }, [
    selectedEpisodeIndex,
  ]);

  useEffect(() => {
    if (
      !episodeListOpen ||
      !mobileEpisodeListRef.current ||
      !parsedNovel
    ) {
      return;
    }

    const selectedButton =
      mobileEpisodeListRef.current.querySelector(
        `[data-episode-index="${selectedEpisodeIndex}"]`
      ) as HTMLElement | null;

    if (!selectedButton) {
      return;
    }

    window.setTimeout(() => {
      selectedButton.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
    }, 0);
  }, [
    episodeListOpen,
    selectedEpisodeIndex,
    episodeSearch,
    filteredEpisodes.length,
    parsedNovel,
  ]);

  function extractErrorMessage(
    data: any,
    fallback: string
  ) {
    if (
      typeof data?.error ===
      "string"
    ) {
      return data.error;
    }

    if (
      data?.error?.message
    ) {
      return data.error.message;
    }

    if (data?.error) {
      try {
        return JSON.stringify(
          data.error
        );
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  async function initializeReadingState(
    fileId: string,
    title: string,
    totalEpisodes: number
  ): Promise<ReadingState | null> {
    try {
      const response =
        await fetch(
          "/api/books",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              drive_file_id:
                fileId,
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
        book:
          stateData?.book,
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
  }

  async function getBookmarkStatus(
    fileId: string,
    episode: number
  ) {
    try {
      const response =
        await fetch(
          `/api/bookmarks?driveFileId=${encodeURIComponent(
            fileId
          )}&episode=${episode}`
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
    } catch (error) {
      console.error(
        "북마크 상태 불러오기 실패:",
        error
      );

      setBookmarked(false);
    }
  }

  async function toggleBookmark() {
    if (
      !selectedFile ||
      !parsedNovel ||
      !bookId
    ) {
      return;
    }

    const episode =
      parsedNovel.episodes[
        selectedEpisodeIndex
      ];

    if (!episode) {
      return;
    }

    setBookmarkLoading(true);

    try {
      if (bookmarked) {
        const response =
          await fetch(
            `/api/bookmarks?driveFileId=${encodeURIComponent(
              selectedFile.id
            )}&episode=${episode.episode}`,
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
                book_id:
                  bookId,
                drive_file_id:
                  selectedFile.id,
                episode:
                  episode.episode,
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
  }

  async function loadHighlights(
    fileId: string,
    episode: number
  ) {
    try {
      const response =
        await fetch(
          `/api/highlights?driveFileId=${encodeURIComponent(
            fileId
          )}&episode=${episode}`
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

      setHighlights(
        data.data || []
      );
    } catch (error) {
      console.error(
        "하이라이트 불러오기 실패:",
        error
      );

      setHighlights([]);
    }
  }

  useEffect(() => {
    if (
      !selectedFile ||
      !selectedEpisode
    ) {
      setHighlights([]);
      return;
    }

    void loadHighlights(
      selectedFile.id,
      selectedEpisode.episode
    );
  }, [
    selectedFile,
    selectedEpisodeIndex,
  ]);

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
          Math.max(
            0,
            targetTop
          );

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
    highlights,
  ]);

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

      scrollPositionRef.current = 0;

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
      window.clearTimeout(timer);
    };
  }, [
    parsedNovel,
    selectedEpisodeIndex,
  ]);

  async function saveScrollPosition(
    position?: number
  ) {
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
          position ?? window.scrollY
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
          ((selectedEpisodeIndex + 1) /
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
              status: isCompleted
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
  }

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
      }
    };
  }, [
    selectedFile,
    parsedNovel,
    selectedEpisode,
    selectedEpisodeIndex,
    roundId,
    roundStatus,
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
            ((selectedEpisodeIndex + 1) /
              totalEpisodes) *
              100
          )
        );

      const isCompleted =
        selectedEpisodeIndex ===
        totalEpisodes - 1;

      const payload = JSON.stringify({
        drive_file_id:
          selectedFile.id,
        round_id:
          roundId,
        episode:
          selectedEpisode.episode,
        progress,
        status: isCompleted
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

  function getBodySearchMatches() {
    if (
      !selectedEpisode ||
      !bodySearch.trim()
    ) {
      return [];
    }

    const content =
      selectedEpisode.content;

    const keyword =
      bodySearch.trim().toLowerCase();

    const lowerContent =
      content.toLowerCase();

    const matches: number[] = [];

    let start = 0;

    while (true) {
      const index =
        lowerContent.indexOf(
          keyword,
          start
        );

      if (index === -1) {
        break;
      }

      matches.push(index);

      start =
        index + keyword.length;
    }

    return matches;
  }

  function scrollToBodySearchMatch(
    direction: 1 | -1
  ) {
    if (
      !contentRef.current ||
      !selectedEpisode ||
      !bodySearch.trim()
    ) {
      return;
    }

    const matches =
      getBodySearchMatches();

    if (matches.length === 0) {
      return;
    }

    let nextIndex =
      bodySearchIndex;

    if (direction === 1) {
      nextIndex =
        (bodySearchIndex + 1) %
        matches.length;
    } else {
      nextIndex =
        (bodySearchIndex - 1 +
          matches.length) %
        matches.length;
    }

    setBodySearchIndex(
      nextIndex
    );

    const targetOffset =
      matches[nextIndex];

    const keywordLength =
      bodySearch.trim().length;

    const walker =
      document.createTreeWalker(
        contentRef.current,
        NodeFilter.SHOW_TEXT
      );

    let currentOffset = 0;

    while (walker.nextNode()) {
      const node =
        walker.currentNode as Text;

      const nodeText =
        node.textContent || "";

      const nodeStart =
        currentOffset;

      const nodeEnd =
        currentOffset +
        nodeText.length;

      if (
        targetOffset >= nodeStart &&
        targetOffset < nodeEnd
      ) {
        const range =
          document.createRange();

        range.setStart(
          node,
          targetOffset - nodeStart
        );

        range.setEnd(
          node,
          Math.min(
            targetOffset -
              nodeStart +
              keywordLength,
            nodeText.length
          )
        );

        const rect =
          range.getBoundingClientRect();

        const targetTop =
          window.scrollY +
          rect.top -
          window.innerHeight / 2;

        window.scrollTo({
          top: Math.max(
            0,
            targetTop
          ),
          behavior: "smooth",
        });

        return;
      }

      currentOffset =
        nodeEnd;
    }
  }

  function getSelectionData() {
    if (!contentRef.current) {
      return null;
    }

    const selection =
      window.getSelection();

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
      startRange
        .toString()
        .length;

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
      endRange
        .toString()
        .length;

    if (
      endOffset <= startOffset
    ) {
      return null;
    }

    return {
      text: selectedText,
      startOffset,
      endOffset,
    };
  }

  async function saveHighlight(
    text: string,
    startOffset: number,
    endOffset: number
  ) {
    if (
      !selectedFile ||
      !parsedNovel ||
      !bookId ||
      !selectedEpisode
    ) {
      return;
    }

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
              book_id:
                bookId,
              drive_file_id:
                selectedFile.id,
              episode:
                selectedEpisode.episode,
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
        selectedFile.id,
        selectedEpisode.episode
      );

      window.getSelection()?.removeAllRanges();

      setShowHighlightButton(false);
      setSelectedTextForHighlight("");
      setSelectedHighlightRange(null);
    } catch (error) {
      console.error(
        "하이라이트 저장 실패:",
        error
      );
    } finally {
      setHighlightLoading(false);
    }
  }

  function handleTextSelection() {
    window.setTimeout(() => {
      const selectionData =
        getSelectionData();

      if (!selectionData) {
        if (
          window.innerWidth < 768
        ) {
          setShowHighlightButton(false);
          setSelectedTextForHighlight("");
          setSelectedHighlightRange(null);
        }

        return;
      }

      if (
        window.innerWidth < 768
      ) {
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
  }

  async function savePendingHighlight() {
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
  }

  /*
   * 특정 회차의 진행상황 저장
   *
   * context를 전달할 수 있게 하여
   * React state가 아직 갱신되지 않은
   * 최초 진입 시에도 정확한 데이터를 사용한다.
   */
  async function saveProgress(
    episodeIndex: number,
    scrollPosition = 0,
    targetRoundId?: string | null,
    context?: {
      file?: DriveItem;
      novel?: ParsedNovel;
    }
  ) {
    const activeRoundId =
      targetRoundId ?? roundId;

    const activeFile =
      context?.file ?? selectedFile;

    const activeNovel =
      context?.novel ?? parsedNovel;

    if (
      !activeFile ||
      !activeNovel ||
      !activeRoundId
    ) {
      return false;
    }

    /*
     * 이미 완독된 현재 회차는 수정 금지.
     *
     * targetRoundId가 명시된 최초 저장은
     * 새로 생성된 reading 회차일 수 있으므로 허용한다.
     */
    if (
      roundStatus === "completed" &&
      !targetRoundId
    ) {
      return false;
    }

    if (
      activeNovel.episodes.length === 0
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
              status: isCompleted
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
  }

  async function changeEpisode(
    index: number
  ) {
    if (!parsedNovel) {
      return;
    }

    if (progressSaving) {
      return;
    }

    if (
      index < 0 ||
      index >=
        parsedNovel.episodes.length
    ) {
      return;
    }

    if (
      index ===
      selectedEpisodeIndex
    ) {
      setEpisodeListOpen(false);
      return;
    }

    const currentScrollPosition =
      Math.max(
        0,
        Math.round(
          window.scrollY
        )
      );

    /*
     * 완독된 회차에서는 기존 회차를
     * 다시 reading으로 만들면 안 된다.
     */
    if (
      roundStatus !== "completed"
    ) {
      await saveProgress(
        selectedEpisodeIndex,
        currentScrollPosition
      );
    }

    setSelectedEpisodeIndex(
      index
    );

    setEpisodeListOpen(false);

    restoreScrollPositionRef.current =
      0;

    scrollPositionRef.current =
      0;

    setBodySearch("");
    setBodySearchIndex(0);

    window.scrollTo({
      top: 0,
      behavior: "auto",
    });

    /*
     * reading 회차에서만 새 회차 위치 저장.
     */
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
      /*
       * 회차 이동 시에는 북마크가 화면 상태에
       * 바로 필요하므로 기존처럼 기다린다.
       */
      await getBookmarkStatus(
        selectedFile.id,
        episode.episode
      );
    }
  }

  /*
   * ==================================================
   * 소설 열기
   * ==================================================
   */
  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const fileId =
      params.get("fileId");

    const episodeParam =
      params.get("episode");

    const targetEpisode =
      episodeParam
        ? Number(episodeParam)
        : null;

    if (!fileId) {
      setLoading(false);
      setError(
        "파일을 찾을 수 없습니다."
      );
      return;
    }

    let cancelled = false;

    async function openFile() {
      setLoading(true);
      setError("");

      try {
        /*
         * --------------------------------------------
         * 1. 파일 정보 + 실제 파일 병렬 요청
         * --------------------------------------------
         */
        const [
          infoResponse,
          fileResponse,
        ] = await Promise.all([
          fetch(
            `/api/drive/file-info?fileId=${encodeURIComponent(
              fileId
            )}`
          ),

          fetch(
            `/api/drive/file?fileId=${encodeURIComponent(
              fileId
            )}`
          ),
        ]);

        /*
         * JSON parsing도 병렬 처리
         */
        const [
          infoData,
          fileData,
        ] = await Promise.all([
          infoResponse.json(),
          fileResponse.json(),
        ]);

        if (!infoResponse.ok) {
          throw new Error(
            extractErrorMessage(
              infoData,
              "파일 정보를 가져오지 못했습니다."
            )
          );
        }

        if (!fileResponse.ok) {
          throw new Error(
            extractErrorMessage(
              fileData,
              "파일을 가져오지 못했습니다."
            )
          );
        }

        if (cancelled) {
          return;
        }

        /*
         * --------------------------------------------
         * 2. TXT 파싱
         * --------------------------------------------
         */
        const parsed =
          parseNovel(
            fileData.content
          );

        console.log(
          "PARSED NOVEL:",
          parsed
        );

        const item: DriveItem = {
          id: infoData.id,
          name: infoData.name,
          mimeType:
            infoData.mimeType,
          modifiedTime:
            infoData.modifiedTime,
          size: infoData.size,
        };

        /*
         * --------------------------------------------
         * 3. 화면 데이터 세팅
         * --------------------------------------------
         */
        setSelectedFile(item);

        setFileContent(
          fileData.content
        );

        setParsedNovel(parsed);

        /*
         * --------------------------------------------
         * 4. 독서 상태 조회
         * --------------------------------------------
         */
        const readingState =
          await initializeReadingState(
            fileId,
            infoData.name,
            parsed.episodes.length
          );

        if (!readingState) {
          throw new Error(
            "읽기 정보를 불러오지 못했습니다."
          );
        }

        if (cancelled) {
          return;
        }

        const savedProgress =
          readingState.progress;

        let initialEpisodeIndex = 0;

        restoreScrollPositionRef.current =
          0;

        if (highlightId) {
          skipScrollRestoreRef.current =
            true;
        }

        /*
         * --------------------------------------------
         * 5. 시작 회차 결정
         * --------------------------------------------
         */
        if (
          targetEpisode !== null &&
          Number.isFinite(
            targetEpisode
          )
        ) {
          const targetIndex =
            parsed.episodes.findIndex(
              (episode) =>
                episode.episode ===
                targetEpisode
            );

          if (
            targetIndex >= 0
          ) {
            initialEpisodeIndex =
              targetIndex;

            if (
              savedProgress.episode ===
                targetEpisode &&
              !highlightId &&
              typeof savedProgress.scroll_position ===
                "number"
            ) {
              restoreScrollPositionRef.current =
                Math.max(
                  0,
                  savedProgress.scroll_position
                );
            }
          }
        } else {
          /*
           * 저장된 회차 복원
           */
          const savedIndex =
            parsed.episodes.findIndex(
              (episode) =>
                episode.episode ===
                savedProgress.episode
            );

          if (savedIndex >= 0) {
            initialEpisodeIndex =
              savedIndex;
          } else if (
            savedProgress.episode > 0
          ) {
            initialEpisodeIndex =
              Math.max(
                0,
                Math.min(
                  savedProgress.episode - 1,
                  parsed.episodes.length - 1
                )
              );
          }

          if (
            !highlightId &&
            typeof savedProgress.scroll_position ===
              "number"
          ) {
            restoreScrollPositionRef.current =
              Math.max(
                0,
                savedProgress.scroll_position
              );
          }
        }

        /*
         * --------------------------------------------
         * 6. 선택 회차 즉시 반영
         * --------------------------------------------
         */
        setSelectedEpisodeIndex(
          initialEpisodeIndex
        );

        const initialEpisode =
          parsed.episodes[
            initialEpisodeIndex
          ];

        /*
         * --------------------------------------------
         * 7. 북마크는 기다리지 않고 백그라운드 처리
         * --------------------------------------------
         */
        if (initialEpisode) {
          void getBookmarkStatus(
            fileId,
            initialEpisode.episode
          );
        }

        /*
         * --------------------------------------------
         * 8. 최초 진행상황 저장
         *
         * React state 대신 현재 함수의
         * item / parsed를 직접 전달한다.
         *
         * 또한 await하지 않는다.
         * --------------------------------------------
         */
        if (
          readingState.round.status ===
            "reading" &&
          savedProgress.episode ===
            0 &&
          parsed.episodes.length > 0 &&
          targetEpisode === null
        ) {
          restoreScrollPositionRef.current =
            0;

          void saveProgress(
            initialEpisodeIndex,
            0,
            readingState.round.id,
            {
              file: item,
              novel: parsed,
            }
          );
        }

        /*
         * --------------------------------------------
         * 9. 로딩 종료
         *
         * 북마크 / 최초 progress 저장을
         * 기다리지 않는다.
         * --------------------------------------------
         */
        setLoading(false);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "소설 열기 실패:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "소설을 가져오지 못했습니다."
        );

        setLoading(false);
      }
    }

    void openFile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function closeFile() {
    /*
     * 완독 회차는 종료할 때
     * 기존 완독 기록을 다시 저장하지 않는다.
     */
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
  }

  async function goToPrevEpisode() {
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
  }

  async function goToNextEpisode() {
    if (
      !parsedNovel ||
      progressSaving
    ) {
      return;
    }

    const nextIndex =
      Math.min(
        parsedNovel.episodes.length -
          1,
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
  }

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{
          backgroundColor:
            theme.bg,
          color:
            theme.muted,
        }}
      >
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          소설을 불러오는 중...
        </div>
      </main>
    );
  }

  if (
    error ||
    !selectedFile
  ) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-6"
        style={{
          backgroundColor:
            theme.bg,
          color:
            theme.text,
        }}
      >
        <div className="text-center">
          <p
            className="text-sm"
            style={{
              color:
                theme.title,
            }}
          >
            {error ||
              "파일을 찾을 수 없습니다."}
          </p>

          <button
            onClick={closeFile}
            className="mt-5 text-sm hover:opacity-70"
            style={{
              color:
                theme.muted,
            }}
          >
            돌아가기
          </button>
        </div>
      </main>
    );
  }

  const isFirstEpisode =
    selectedEpisodeIndex === 0;

  const isLastEpisode =
    parsedNovel
      ? selectedEpisodeIndex ===
        parsedNovel.episodes.length - 1
      : true;

  const bodySearchMatches =
    getBodySearchMatches();

  return (
    <main
      className="min-h-screen transition-colors"
      style={{
        backgroundColor:
          theme.bg,
        color:
          theme.title,
      }}
    >
      <header>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 md:px-8 md:py-8">
          <div className="min-w-0">
            <button
              onClick={closeFile}
              className="mb-3 flex items-center gap-2 text-sm hover:opacity-70"
              style={{
                color:
                  theme.muted,
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              돌아가기
            </button>

            <h1
              className="truncate text-xl font-medium md:text-2xl"
              style={{
                fontFamily: SERIF,
              }}
            >
              {selectedFile.name}
            </h1>
          </div>

          {parsedNovel && (
            <div className="ml-6 shrink-0 text-right">
              <p
                className="text-xs"
                style={{
                  color:
                    theme.muted,
                }}
              >
                전체 회차
              </p>

              <p className="font-medium">
                {
                  parsedNovel.totalEpisodes
                }
                화
              </p>

              {progressSaving && (
                <p
                  className="mt-1 text-[10px]"
                  style={{
                    color:
                      theme.muted,
                  }}
                >
                  저장 중...
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-24 md:px-8">
        {!parsedNovel ? (
          <div
            className="px-6 py-14 text-center text-sm"
            style={{
              color:
                theme.muted,
            }}
          >
            파싱 결과를 불러오는 중...
          </div>
        ) : parsedNovel.episodes.length ===
          0 ? (
          <div className="px-6 py-14 text-center">
            <p
              className="text-sm"
              style={{
                color:
                  theme.text,
              }}
            >
              회차를 찾지 못했습니다.
            </p>

            <p
              className="mt-2 text-xs"
              style={{
                color:
                  theme.muted,
              }}
            >
              원문은 정상적으로 가져왔지만
              회차 구조를 인식하지 못했습니다.
            </p>

            <details className="mt-6 text-left">
              <summary
                className="cursor-pointer text-xs"
                style={{
                  color:
                    theme.muted,
                }}
              >
                원문 보기
              </summary>

              <pre
                className="mt-4 whitespace-pre-wrap break-words text-sm leading-8"
                style={{
                  fontFamily:
                    SERIF,
                  color:
                    theme.text,
                }}
              >
                {fileContent}
              </pre>
            </details>
          </div>
        ) : (
          <>
            <div className="mb-5 md:hidden">
              <button
                type="button"
                onClick={() =>
                  setEpisodeListOpen(
                    (open) => !open
                  )
                }
                className="flex w-full items-center justify-between rounded-[4px] px-4 py-3 text-left transition hover:opacity-80"
                style={{
                  backgroundColor:
                    theme.bg,
                  boxShadow: `0 0 0 0.5px ${theme.divider}`,
                }}
                aria-expanded={
                  episodeListOpen
                }
                aria-label="회차 목록 열기"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="shrink-0 text-xs"
                    style={{
                      color:
                        theme.accent,
                    }}
                  >
                    회차 목록
                  </span>

                  {selectedEpisode && (
                    <span
                      className="min-w-0 truncate text-sm"
                      style={{
                        fontFamily:
                          SERIF,
                        color:
                          theme.title,
                      }}
                    >
                      {selectedEpisode.episode}화
                      {" · "}
                      {selectedEpisode.title}
                    </span>
                  )}
                </div>

                {episodeListOpen ? (
                  <ChevronUp
                    className="ml-3 h-4 w-4 shrink-0"
                    style={{
                      color:
                        theme.muted,
                    }}
                  />
                ) : (
                  <ChevronDown
                    className="ml-3 h-4 w-4 shrink-0"
                    style={{
                      color:
                        theme.muted,
                    }}
                  />
                )}
              </button>

              {episodeListOpen && (
                <div
                  className="mt-2 overflow-hidden rounded-[4px]"
                  style={{
                    boxShadow: `0 0 0 0.5px ${theme.divider}`,
                  }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2.5"
                    style={{
                      borderBottom: `0.5px solid ${theme.divider}`,
                    }}
                  >
                    <Search
                      className="h-4 w-4 shrink-0"
                      style={{
                        color:
                          theme.muted,
                      }}
                    />

                    <input
                      type="text"
                      value={episodeSearch}
                      onChange={(e) =>
                        setEpisodeSearch(
                          e.target.value
                        )
                      }
                      placeholder="회차 검색"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      style={{
                        color:
                          theme.title,
                      }}
                    />

                    {episodeSearch && (
                      <button
                        onClick={() =>
                          setEpisodeSearch("")
                        }
                        className="shrink-0"
                        style={{
                          color:
                            theme.muted,
                        }}
                        aria-label="회차 검색어 지우기"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div
                    ref={
                      mobileEpisodeListRef
                    }
                    className="max-h-72 overflow-y-auto"
                  >
                    {filteredEpisodes.length ===
                    0 ? (
                      <p
                        className="px-4 py-5 text-center text-xs"
                        style={{
                          color:
                            theme.muted,
                        }}
                      >
                        검색 결과가 없습니다.
                      </p>
                    ) : (
                      filteredEpisodes.map(
                        (episode) => {
                          const index =
                            parsedNovel.episodes.indexOf(
                              episode
                            );

                          const isSelected =
                            index ===
                            selectedEpisodeIndex;

                          return (
                            <button
                              key={`${episode.startLine}-${index}`}
                              data-episode-index={
                                index
                              }
                              onClick={() =>
                                changeEpisode(
                                  index
                                )
                              }
                              disabled={
                                progressSaving
                              }
                              className="w-full border-b px-4 py-3 text-left transition last:border-b-0 disabled:opacity-50"
                              style={{
                                borderColor:
                                  theme.divider,
                                backgroundColor:
                                  isSelected
                                    ? `${theme.accent}10`
                                    : "transparent",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="shrink-0 text-xs"
                                  style={{
                                    color:
                                      isSelected
                                        ? theme.accent
                                        : theme.muted,
                                  }}
                                >
                                  {
                                    episode.episode
                                  }
                                  화
                                </span>

                                <span
                                  className="min-w-0 truncate text-sm"
                                  style={{
                                    fontFamily:
                                      SERIF,
                                    color:
                                      isSelected
                                        ? theme.title
                                        : theme.text,
                                    fontWeight:
                                      isSelected
                                        ? 500
                                        : 400,
                                  }}
                                >
                                  {
                                    episode.title
                                  }
                                </span>
                              </div>
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
              <aside className="hidden md:block">
                <div className="sticky top-8">
                  <div
                    className="mb-4 flex items-center gap-2 rounded-[4px] px-3 py-2"
                    style={{
                      boxShadow: `0 0 0 0.5px ${theme.divider}`,
                    }}
                  >
                    <Search
                      className="h-4 w-4 shrink-0"
                      style={{
                        color:
                          theme.muted,
                      }}
                    />

                    <input
                      type="text"
                      value={
                        episodeSearch
                      }
                      onChange={(e) =>
                        setEpisodeSearch(
                          e.target.value
                        )
                      }
                      placeholder="회차 검색"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      style={{
                        color:
                          theme.title,
                      }}
                    />

                    {episodeSearch && (
                      <button
                        onClick={() =>
                          setEpisodeSearch(
                            ""
                          )
                        }
                        className="shrink-0"
                        style={{
                          color:
                            theme.muted,
                        }}
                        aria-label="회차 검색어 지우기"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <p
                    className="mb-3 px-1 text-xs"
                    style={{
                      color:
                        theme.muted,
                    }}
                  >
                    {episodeSearch
                      ? `${filteredEpisodes.length}개 회차`
                      : `전체 ${parsedNovel.totalEpisodes}화`}
                  </p>

                  <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                    {filteredEpisodes.length ===
                    0 ? (
                      <p
                        className="px-2 py-6 text-center text-xs"
                        style={{
                          color:
                            theme.muted,
                        }}
                      >
                        검색 결과가 없습니다.
                      </p>
                    ) : (
                      filteredEpisodes.map(
                        (episode) => {
                          const index =
                            parsedNovel.episodes.indexOf(
                              episode
                            );

                          const isSelected =
                            index ===
                            selectedEpisodeIndex;

                          return (
                            <button
                              key={`${episode.startLine}-${index}`}
                              onClick={() =>
                                changeEpisode(
                                  index
                                )
                              }
                              disabled={
                                progressSaving
                              }
                              className="w-full px-2 py-2.5 text-left transition disabled:opacity-50"
                              style={{
                                color:
                                  isSelected
                                    ? theme.title
                                    : theme.muted,
                              }}
                            >
                              <p
                                className="truncate text-sm"
                                style={{
                                  fontFamily:
                                    SERIF,
                                  fontWeight:
                                    isSelected
                                      ? 500
                                      : 400,
                                }}
                              >
                                {
                                  episode.title
                                }
                              </p>

                              <p
                                className="mt-0.5 text-xs"
                                style={{
                                  color:
                                    theme.muted,
                                  opacity:
                                    0.7,
                                }}
                              >
                                {
                                  episode.episode
                                }
                                화
                              </p>
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                </div>
              </aside>

              <article>
                {selectedEpisode ? (
                  <>
                    <div
                      className="px-1 py-2 md:px-2"
                      style={{
                        borderTop: `0.5px solid ${theme.divider}`,
                      }}
                    >
                      <div className="pt-6">
                        <p
                          className="text-xs tracking-wide"
                          style={{
                            color:
                              theme.accent,
                          }}
                        >
                          {
                            selectedEpisode.episode
                          }
                          화
                        </p>

                        <h2
                          className="mt-2 text-xl font-medium md:text-2xl"
                          style={{
                            fontFamily:
                              SERIF,
                          }}
                        >
                          {
                            selectedEpisode.title
                          }
                        </h2>

                        <div className="mt-4 flex items-center">
                          <button
                            onClick={
                              toggleBookmark
                            }
                            disabled={
                              bookmarkLoading
                            }
                            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition disabled:opacity-50"
                            style={{
                              color:
                                bookmarked
                                  ? theme.accent
                                  : theme.muted,
                              backgroundColor:
                                bookmarked
                                  ? `${theme.accent}12`
                                  : "transparent",
                            }}
                          >
                            <Bookmark
                              className="h-4 w-4"
                              fill={
                                bookmarked
                                  ? "currentColor"
                                  : "none"
                              }
                            />

                            {bookmarked
                              ? "북마크됨"
                              : "북마크"}
                          </button>
                        </div>

                        <div className="mt-5">
                          {!bodySearchOpen ? (
                            <button
                              onClick={() => {
                                setBodySearchOpen(
                                  true
                                );
                                setBodySearchIndex(
                                  0
                                );
                              }}
                              className="flex items-center gap-1.5 text-xs hover:opacity-70"
                              style={{
                                color:
                                  theme.muted,
                              }}
                            >
                              <Search className="h-3.5 w-3.5" />
                              본문 검색
                            </button>
                          ) : (
                            <div
                              className="flex items-center gap-2 rounded-[4px] px-3 py-2"
                              style={{
                                boxShadow: `0 0 0 0.5px ${theme.divider}`,
                              }}
                            >
                              <Search
                                className="h-4 w-4 shrink-0"
                                style={{
                                  color:
                                    theme.muted,
                                }}
                              />

                              <input
                                autoFocus
                                type="text"
                                value={
                                  bodySearch
                                }
                                onChange={(
                                  e
                                ) =>
                                  setBodySearch(
                                    e.target.value
                                  )
                                }
                                onKeyDown={(
                                  e
                                ) => {
                                  if (
                                    e.key ===
                                    "Enter"
                                  ) {
                                    scrollToBodySearchMatch(
                                      1
                                    );
                                  }

                                  if (
                                    e.key ===
                                    "Escape"
                                  ) {
                                    setBodySearch(
                                      ""
                                    );
                                    setBodySearchOpen(
                                      false
                                    );
                                  }
                                }}
                                placeholder="본문에서 검색"
                                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                                style={{
                                  color:
                                    theme.title,
                                }}
                              />

                              {bodySearch.trim() && (
                                <span
                                  className="shrink-0 text-[11px]"
                                  style={{
                                    color:
                                      theme.muted,
                                  }}
                                >
                                  {bodySearchMatches.length >
                                  0
                                    ? `${bodySearchIndex + 1}/${bodySearchMatches.length}`
                                    : "0/0"}
                                </span>
                              )}

                              <button
                                onClick={() =>
                                  scrollToBodySearchMatch(
                                    -1
                                  )
                                }
                                disabled={
                                  bodySearchMatches.length ===
                                  0
                                }
                                className="p-1 disabled:opacity-30"
                                style={{
                                  color:
                                    theme.title,
                                }}
                                aria-label="이전 검색 결과"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() =>
                                  scrollToBodySearchMatch(
                                    1
                                  )
                                }
                                disabled={
                                  bodySearchMatches.length ===
                                  0
                                }
                                className="p-1 disabled:opacity-30"
                                style={{
                                  color:
                                    theme.title,
                                }}
                                aria-label="다음 검색 결과"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => {
                                  setBodySearch(
                                    ""
                                  );
                                  setBodySearchOpen(
                                    false
                                  );
                                }}
                                className="p-1"
                                style={{
                                  color:
                                    theme.muted,
                                }}
                                aria-label="본문 검색 닫기"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mx-auto mt-8 max-w-2xl">
                          <div
                            ref={
                              contentRef
                            }
                            onMouseUp={
                              handleTextSelection
                            }
                            onTouchEnd={
                              handleTextSelection
                            }
                            className="whitespace-pre-wrap break-words"
                            style={{
                              fontFamily:
                                SERIF,
                              fontSize: `${fontSize}px`,
                              lineHeight: 2,
                              color:
                                theme.text,
                              userSelect:
                                "text",
                            }}
                          >
                            {(() => {
                              const content =
                                selectedEpisode.content;

                              if (
                                highlights.length ===
                                0
                              ) {
                                return content;
                              }

                              const validHighlights =
                                highlights
                                  .filter(
                                    (
                                      highlight
                                    ) =>
                                      typeof highlight.start_offset ===
                                        "number" &&
                                      typeof highlight.end_offset ===
                                        "number" &&
                                      highlight.end_offset >
                                        highlight.start_offset
                                  )
                                  .map(
                                    (
                                      highlight
                                    ) => ({
                                      ...highlight,
                                      start_offset:
                                        highlight.start_offset as number,
                                      end_offset:
                                        highlight.end_offset as number,
                                    })
                                  )
                                  .filter(
                                    (
                                      highlight
                                    ) =>
                                      highlight.start_offset >=
                                        0 &&
                                      highlight.end_offset <=
                                        content.length
                                  )
                                  .sort(
                                    (
                                      a,
                                      b
                                    ) =>
                                      a.start_offset -
                                      b.start_offset
                                  );

                              if (
                                validHighlights.length ===
                                0
                              ) {
                                return content;
                              }

                              const parts: ReactNode[] =
                                [];

                              let currentPosition =
                                0;

                              validHighlights.forEach(
                                (
                                  highlight,
                                  index
                                ) => {
                                  const start =
                                    highlight.start_offset;

                                  const end =
                                    highlight.end_offset;

                                  if (
                                    start >
                                    currentPosition
                                  ) {
                                    parts.push(
                                      <span
                                        key={`text-${index}`}
                                      >
                                        {content.slice(
                                          currentPosition,
                                          start
                                        )}
                                      </span>
                                    );
                                  }

                                  if (
                                    end >
                                    currentPosition
                                  ) {
                                    const actualStart =
                                      Math.max(
                                        start,
                                        currentPosition
                                      );

                                    parts.push(
                                      <span
                                        key={`highlight-${highlight.id}`}
                                        data-highlight-id={
                                          highlight.id
                                        }
                                        style={{
                                          backgroundColor:
                                            "rgba(255, 225, 120, 0.5)",
                                          borderRadius:
                                            "2px",
                                        }}
                                      >
                                        {content.slice(
                                          actualStart,
                                          end
                                        )}
                                      </span>
                                    );

                                    currentPosition =
                                      end;
                                  }
                                }
                              );

                              if (
                                currentPosition <
                                content.length
                              ) {
                                parts.push(
                                  <span key="text-last">
                                    {content.slice(
                                      currentPosition
                                    )}
                                  </span>
                                );
                              }

                              return parts;
                            })()}
                          </div>
                        </div>

                        <div className="mx-auto mt-10 hidden max-w-2xl items-center justify-between md:flex">
                          <button
                            onClick={
                              goToPrevEpisode
                            }
                            disabled={
                              isFirstEpisode ||
                              progressSaving
                            }
                            className="rounded-[4px] px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
                            style={{
                              backgroundColor:
                                theme.divider,
                              color:
                                theme.title,
                            }}
                          >
                            ← 이전화
                          </button>

                          <button
                            onClick={
                              goToNextEpisode
                            }
                            disabled={
                              isLastEpisode ||
                              progressSaving
                            }
                            className="rounded-[4px] px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
                            style={{
                              backgroundColor:
                                theme.divider,
                              color:
                                theme.title,
                            }}
                          >
                            다음화 →
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 md:hidden">
                      <button
                        onClick={
                          goToPrevEpisode
                        }
                        disabled={
                          isFirstEpisode ||
                          progressSaving
                        }
                        className="flex flex-1 items-center justify-center gap-1 rounded-[4px] px-3 py-3 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
                        style={{
                          backgroundColor:
                            theme.divider,
                          color:
                            theme.title,
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        이전화
                      </button>

                      <button
                        onClick={
                          goToNextEpisode
                        }
                        disabled={
                          isLastEpisode ||
                          progressSaving
                        }
                        className="flex flex-1 items-center justify-center gap-1 rounded-[4px] px-3 py-3 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
                        style={{
                          backgroundColor:
                            theme.divider,
                          color:
                            theme.title,
                        }}
                      >
                        다음화
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    className="flex h-full items-center justify-center text-sm"
                    style={{
                      color:
                        theme.muted,
                    }}
                  >
                    회차를 선택하세요.
                  </div>
                )}
              </article>
            </div>
          </>
        )}
      </section>

      {showHighlightButton &&
        selectedTextForHighlight && (
          <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 md:hidden">
            <button
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onTouchStart={(e) =>
                e.preventDefault()
              }
              onClick={
                savePendingHighlight
              }
              disabled={
                highlightLoading
              }
              className="rounded-full px-5 py-3 text-sm font-medium shadow-lg transition disabled:opacity-60"
              style={{
                backgroundColor:
                  theme.title,
                color:
                  theme.bg,
              }}
            >
              {highlightLoading
                ? "저장 중..."
                : "하이라이트"}
            </button>
          </div>
        )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {settingsOpen && (
          <div
            className="w-64 rounded-2xl p-5"
            style={{
              backgroundColor:
                theme.bg,
              color:
                theme.title,
              boxShadow:
                "0 4px 20px rgba(0,0,0,0.18)",
              border: `0.5px solid ${theme.divider}`,
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p
                className="text-sm font-semibold"
                style={{
                  color:
                    theme.title,
                }}
              >
                읽기 설정
              </p>

              <button
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
                aria-label="설정 닫기"
                className="hover:opacity-70"
                style={{
                  color:
                    theme.muted,
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p
              className="mb-2 text-xs font-semibold"
              style={{
                color:
                  theme.text,
              }}
            >
              글자 크기
            </p>

            <div className="mb-5 flex items-center gap-3">
              <button
                onClick={() =>
                  setFontSize(
                    (s) =>
                      Math.max(
                        MIN_FONT_SIZE,
                        s - 1
                      )
                  )
                }
                className="rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  color:
                    theme.title,
                  border: `1px solid ${theme.divider}`,
                }}
              >
                가-
              </button>

              <input
                type="range"
                min={
                  MIN_FONT_SIZE
                }
                max={
                  MAX_FONT_SIZE
                }
                step={1}
                value={fontSize}
                onChange={(e) =>
                  setFontSize(
                    Number(
                      e.target.value
                    )
                  )
                }
                className="flex-1"
              />

              <button
                onClick={() =>
                  setFontSize(
                    (s) =>
                      Math.min(
                        MAX_FONT_SIZE,
                        s + 1
                      )
                  )
                }
                className="rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  color:
                    theme.title,
                  border: `1px solid ${theme.divider}`,
                }}
              >
                가+
              </button>
            </div>

            <p
              className="mb-2 text-xs font-semibold"
              style={{
                color:
                  theme.text,
              }}
            >
              배경색
            </p>

            <div className="flex items-center gap-3">
              {(
                Object.keys(
                  THEMES
                ) as ThemeKey[]
              ).map((key) => {
                const t =
                  THEMES[key];

                const isSelected =
                  key ===
                  themeKey;

                return (
                  <button
                    key={key}
                    onClick={() =>
                      setThemeKey(
                        key
                      )
                    }
                    aria-label={
                      t.label
                    }
                    className="flex flex-col items-center gap-1"
                  >
                    <span
                      className="block h-8 w-8 rounded-full"
                      style={{
                        backgroundColor:
                          t.swatch,
                        boxShadow:
                          isSelected
                            ? `0 0 0 2px ${t.accent}`
                            : `0 0 0 0.5px ${t.divider}`,
                      }}
                    />

                    <span
                      className="text-[10px] font-medium"
                      style={{
                        color:
                          theme.text,
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() =>
            setSettingsOpen(
              (v) => !v
            )
          }
          aria-label="읽기 설정 열기"
          className="flex h-12 w-12 items-center justify-center rounded-full hover:opacity-90"
          style={{
            backgroundColor:
              theme.title,
            color:
              theme.bg,
            boxShadow:
              "0 4px 14px rgba(0,0,0,0.2)",
          }}
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </main>
  );
}
