"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  BookOpen,
  RotateCcw,
  ArrowUp,
  Search,
  X,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

type Book = {
  id: string;
  user_id: string;
  drive_file_id: string;
  title: string;
  total_episodes: number;
  last_episode: number;
  progress: number;
  status: "읽는 중" | "완독" | "안 읽음";
  created_at: string;
  updated_at: string;
  series_status: "ongoing" | "completed";

  round_count?: number;
  completed_round_count?: number;
  current_round?: number | null;
  current_round_id?: string | null;
  current_episode?: number | null;
  current_progress?: number | null;
  current_scroll_position?: number | null;
};

const statusStyle: Record<string, string> = {
  "읽는 중": "bg-blue-50 text-blue-700",
  "완독": "bg-green-50 text-green-700",
  "안 읽음": "bg-gray-100 text-gray-500",
};

const progressBarColor: Record<string, string> = {
  "읽는 중": "bg-blue-600",
  "완독": "bg-green-600",
  "안 읽음": "bg-gray-300",
};

const CHOSUNG_LIST = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

const CHOSUNG_GROUP: Record<string, string> = {
  "ㄱ": "ㄱ",
  "ㄲ": "ㄱ",
  "ㄴ": "ㄴ",
  "ㄷ": "ㄷ",
  "ㄸ": "ㄷ",
  "ㄹ": "ㄹ",
  "ㅁ": "ㅁ",
  "ㅂ": "ㅂ",
  "ㅃ": "ㅂ",
  "ㅅ": "ㅅ",
  "ㅆ": "ㅅ",
  "ㅇ": "ㅇ",
  "ㅈ": "ㅈ",
  "ㅉ": "ㅈ",
  "ㅊ": "ㅊ",
  "ㅋ": "ㅋ",
  "ㅌ": "ㅌ",
  "ㅍ": "ㅍ",
  "ㅎ": "ㅎ",
};

const INDEX_ORDER = [
  "ㄱ",
  "ㄴ",
  "ㄷ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅅ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "#",
];

function getTitleEpisodeCount(title: string): number {
  const matches = [...title.matchAll(/(\d+)\s*[-~]\s*(\d+)/g)];

  if (matches.length === 0) {
    return 0;
  }

  const last = matches[matches.length - 1];
  const count = parseInt(last[2], 10);

  return Number.isFinite(count) ? count : 0;
}

function getEffectiveTotalEpisodes(book: Book): number {
  return Math.max(
    book.total_episodes || 0,
    getTitleEpisodeCount(book.title)
  );
}

const TOGGLE_TAGS = [
  "완결",
  "미완",
  "단편",
  "중편",
  "장편",
] as const;

type ToggleTag = (typeof TOGGLE_TAGS)[number];

const COMPLETION_TAGS: ToggleTag[] = [
  "완결",
  "미완",
];

const LENGTH_TAGS: ToggleTag[] = [
  "단편",
  "중편",
  "장편",
];

function getLengthBucket(
  book: Book
): "단편" | "중편" | "장편" {
  const total = getEffectiveTotalEpisodes(book);

  if (total > 1000) return "장편";
  if (total >= 500) return "중편";

  return "단편";
}

function getIndexKey(title: string): string {
  const trimmed = title.trim();

  if (!trimmed) {
    return "#";
  }

  const code = trimmed.charCodeAt(0);

  if (code >= 0xac00 && code <= 0xd7a3) {
    const choIndex = Math.floor(
      (code - 0xac00) / (21 * 28)
    );

    const cho = CHOSUNG_LIST[choIndex];

    return CHOSUNG_GROUP[cho] ?? "#";
  }

  const upper = trimmed[0].toUpperCase();

  if (upper >= "A" && upper <= "Z") {
    return upper;
  }

  return "#";
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("전체");

  const [activeTags, setActiveTags] = useState<
    Set<ToggleTag>
  >(() => new Set());

  const [sortOption, setSortOption] = useState<
    "default" | "episodes" | "title"
  >("default");

  const [search, setSearch] = useState("");
  const [showScrollTop, setShowScrollTop] =
    useState(false);
  const [syncing, setSyncing] = useState(false);

  const bookRowRefs = useRef<
    Record<string, HTMLDivElement | null>
  >({});

  // 실제 소설 목록 스크롤 영역
  const bookListScrollRef =
    useRef<HTMLDivElement | null>(null);

  // 오른쪽 커스텀 스크롤바 트랙
  const scrollBarRef =
    useRef<HTMLDivElement | null>(null);

  // 커스텀 스크롤바 thumb 크기 / 위치
  const [scrollThumb, setScrollThumb] = useState({
    height: 0,
    top: 0,
  });

  // thumb 드래그 상태
  const isDraggingScrollThumb =
    useRef(false);

  // 손가락이 thumb의 어느 위치를 잡았는지
  const scrollDragOffset =
    useRef(0);

  function toggleTag(tag: ToggleTag) {
    setActiveTags((prev) => {
      const next = new Set(prev);

      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }

      return next;
    });
  }

  function resetTags() {
    setActiveTags(new Set());
  }

  // 커스텀 스크롤바의 위치와 높이 계산
  function updateScrollThumb() {
    const container =
      bookListScrollRef.current;

    const scrollBar =
      scrollBarRef.current;

    if (!container || !scrollBar) {
      return;
    }

    const {
      scrollHeight,
      clientHeight,
      scrollTop,
    } = container;

    if (scrollHeight <= clientHeight) {
      setScrollThumb({
        height: 0,
        top: 0,
      });

      return;
    }

    const trackHeight =
      scrollBar.clientHeight;

    if (trackHeight <= 0) {
      return;
    }

    const calculatedThumbHeight =
      (clientHeight / scrollHeight) *
      trackHeight;

    const thumbHeight = Math.max(
      42,
      calculatedThumbHeight
    );

    const safeThumbHeight = Math.min(
      thumbHeight,
      trackHeight
    );

    const maxThumbTop = Math.max(
      0,
      trackHeight - safeThumbHeight
    );

    const maxScrollTop =
      scrollHeight - clientHeight;

    const thumbTop =
      maxScrollTop > 0
        ? (scrollTop / maxScrollTop) *
          maxThumbTop
        : 0;

    setScrollThumb({
      height: safeThumbHeight,
      top: thumbTop,
    });
  }

  function changeSortOption(
    option: "default" | "episodes" | "title"
  ) {
    if (bookListScrollRef.current) {
      bookListScrollRef.current.scrollTop = 0;
    }

    startTransition(() => {
      setSortOption(option);
    });
  }

  async function loadBooks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/books"
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "서재를 불러오지 못했습니다."
        );
      }

      setBooks(data.data || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "서재를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooks();
  }, []);

  // 페이지 전체 스크롤에 따른 맨 위로 버튼
  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(
        window.scrollY > 400
      );
    }

    window.addEventListener(
      "scroll",
      handleScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, []);

  const filteredBooks = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesStatus =
        filter === "전체" ||
        getDisplayStatus(book) === filter;

      const activeCompletionTags =
        COMPLETION_TAGS.filter((tag) =>
          activeTags.has(tag)
        );

      const matchesCompletion =
        activeCompletionTags.length === 0 ||
        activeCompletionTags.some(
          (tag) =>
            (tag === "완결" &&
              book.series_status ===
                "completed") ||
            (tag === "미완" &&
              book.series_status ===
                "ongoing")
        );

      const activeLengthTags =
        LENGTH_TAGS.filter((tag) =>
          activeTags.has(tag)
        );

      const matchesLength =
        activeLengthTags.length === 0 ||
        activeLengthTags.includes(
          getLengthBucket(book)
        );

      const matchesSearch =
        keyword === "" ||
        book.title
          .toLowerCase()
          .includes(keyword);

      return (
        matchesStatus &&
        matchesCompletion &&
        matchesLength &&
        matchesSearch
      );
    });
  }, [
    books,
    filter,
    activeTags,
    search,
  ]);

  const sortedBooks = useMemo(() => {
    const list = [...filteredBooks];

    if (sortOption === "episodes") {
      list.sort(
        (a, b) =>
          getEffectiveTotalEpisodes(b) -
          getEffectiveTotalEpisodes(a)
      );
    } else if (sortOption === "title") {
      list.sort((a, b) =>
        a.title.localeCompare(
          b.title,
          "ko"
        )
      );
    }

    return list;
  }, [
    filteredBooks,
    sortOption,
  ]);

  // =========================================================
  // 중요:
  // sortedBooks가 선언된 이후에 스크롤바 effect를 배치한다.
  // 기존 ReferenceError:
  // Cannot access 'sortedBooks' before initialization
  // 를 방지한다.
  // =========================================================
  useEffect(() => {
    const container =
      bookListScrollRef.current;

    const scrollBar =
      scrollBarRef.current;

    if (!container || !scrollBar) {
      return;
    }

    let frameId = 0;

    function handleScroll() {
      if (frameId) {
        return;
      }

      frameId = requestAnimationFrame(() => {
        updateScrollThumb();
        frameId = 0;
      });
    }

    container.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    const resizeObserver =
      new ResizeObserver(() => {
        updateScrollThumb();
      });

    resizeObserver.observe(container);
    resizeObserver.observe(scrollBar);

    window.addEventListener(
      "resize",
      updateScrollThumb
    );

    requestAnimationFrame(() => {
      updateScrollThumb();
    });

    return () => {
      container.removeEventListener(
        "scroll",
        handleScroll
      );

      resizeObserver.disconnect();

      window.removeEventListener(
        "resize",
        updateScrollThumb
      );

      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [sortedBooks.length]);





  const indexAnchors = useMemo(() => {
    const map = new Map<string, string>();

    for (const book of sortedBooks) {
      const key = getIndexKey(book.title);

      if (!map.has(key)) {
        map.set(key, book.id);
      }
    }

    return map;
  }, [sortedBooks]);

  const availableIndexLetters = useMemo(
    () =>
      INDEX_ORDER.filter((letter) =>
        indexAnchors.has(letter)
      ),
    [indexAnchors]
  );

  function jumpToIndex(letter: string) {
    const titleSorted = [
      ...filteredBooks,
    ].sort((a, b) =>
      a.title.localeCompare(
        b.title,
        "ko"
      )
    );

    const target = titleSorted.find(
      (book) =>
        getIndexKey(book.title) ===
        letter
    );

    setSortOption("title");

    if (target) {
      requestAnimationFrame(() => {
        bookRowRefs.current[
          target.id
        ]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      });
    }
  }

  const recentBooks = useMemo(() => {
    return [...books]
      .filter(
        (book) =>
          book.status === "읽는 중" ||
          (book.progress > 0 &&
            book.progress < 100)
      )
      .sort(
        (a, b) =>
          new Date(
            b.updated_at
          ).getTime() -
          new Date(
            a.updated_at
          ).getTime()
      )
      .slice(0, 3);
  }, [books]);

  function getReaderUrl(book: Book) {
    return `/drive?fileId=${encodeURIComponent(
      book.drive_file_id
    )}&fileName=${encodeURIComponent(
      book.title
    )}`;
  }

  async function restartReading(book: Book) {
    if (book.status !== "완독") {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        "/api/books",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            drive_file_id:
              book.drive_file_id,
            title: book.title,
            total_episodes:
              book.total_episodes,
            restart: true,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error ===
            "string"
            ? data.error
            : "다시 읽기를 시작하지 못했습니다."
        );
      }

      await loadBooks();

      window.location.href =
        getReaderUrl(book);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "다시 읽기를 시작하지 못했습니다."
      );
    }
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function getRound(book: Book) {
    return (
      book.current_round ??
      book.round_count ??
      1
    );
  }

  function getEpisode(book: Book) {
    if (
      book.current_episode !== null &&
      book.current_episode !==
        undefined &&
      book.current_episode > 0
    ) {
      return book.current_episode;
    }

    if (book.last_episode > 0) {
      return book.last_episode;
    }

    return 1;
  }

  function getProgress(book: Book) {
    return (
      book.current_progress ??
      book.progress ??
      0
    );
  }

  function getDisplayStatus(book: Book) {
    if (
      (book.completed_round_count ??
        0) > 0
    ) {
      return "완독";
    }

    return book.status;
  }

  // 스크롤바 thumb을 손가락으로 잡기 시작
  function handleScrollThumbPointerDown(
    event: PointerEvent<HTMLDivElement>
  ) {
    const thumb =
      event.currentTarget;

    const container =
      bookListScrollRef.current;

    const scrollBar =
      scrollBarRef.current;

    if (
      !container ||
      !scrollBar ||
      scrollThumb.height <= 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    isDraggingScrollThumb.current =
      true;

    const thumbRect =
      thumb.getBoundingClientRect();

    // 손가락이 thumb의 어느 지점을 잡았는지 기억
    scrollDragOffset.current =
      event.clientY -
      thumbRect.top;

    try {
      thumb.setPointerCapture(
        event.pointerId
      );
    } catch {
      // pointer capture 실패 시 무시
    }
  }

  // thumb을 잡은 상태에서 손가락 이동
  function handleScrollThumbPointerMove(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (
      !isDraggingScrollThumb.current
    ) {
      return;
    }

    const container =
      bookListScrollRef.current;

    const scrollBar =
      scrollBarRef.current;

    if (
      !container ||
      !scrollBar ||
      scrollThumb.height <= 0
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const trackRect =
      scrollBar.getBoundingClientRect();

    const trackHeight =
      trackRect.height;

    const maxThumbTop =
      trackHeight -
      scrollThumb.height;

    if (maxThumbTop <= 0) {
      return;
    }

    let thumbTop =
      event.clientY -
      trackRect.top -
      scrollDragOffset.current;

    thumbTop = Math.max(
      0,
      Math.min(
        thumbTop,
        maxThumbTop
      )
    );

    const ratio =
      thumbTop / maxThumbTop;

    container.scrollTop =
      ratio *
      (container.scrollHeight -
        container.clientHeight);
  }

  // thumb 드래그 종료
  function handleScrollThumbPointerUp(
    event: PointerEvent<HTMLDivElement>
  ) {
    isDraggingScrollThumb.current =
      false;

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      // pointer capture가 이미 해제된 경우 무시
    }
  }

  function renderAction(
    book: Book,
    compact = false
  ) {
    const commonClass = compact
      ? "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm"
      : "rounded-lg px-2.5 py-1.5 text-xs font-medium transition";

    if (book.status === "완독") {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            restartReading(book);
          }}
          className={`${commonClass} bg-gray-900 text-white hover:bg-gray-800`}
        >
          다시 읽기
        </button>
      );
    }

    if (book.status === "안 읽음") {
      return (
        <Link
          href={getReaderUrl(book)}
          onClick={(event) =>
            event.stopPropagation()
          }
          className={`${commonClass} bg-gray-900 text-white hover:bg-gray-800`}
        >
          읽기 시작
        </Link>
      );
    }

    return (
      <Link
        href={getReaderUrl(book)}
        onClick={(event) =>
          event.stopPropagation()
        }
        className={`${commonClass} bg-blue-600 text-white hover:bg-blue-700`}
      >
        이어읽기
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <BookOpen
              className="h-4 w-4 text-gray-900"
              strokeWidth={1.75}
            />

            <h1 className="text-base font-semibold">
              Reader
            </h1>
          </div>

          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-6 sm:pb-28 sm:pt-10">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            내 서재
          </h2>

          <p className="mt-1.5 text-sm text-gray-500 sm:text-base">
            내가 읽고 있는 웹소설을 관리하세요.
          </p>
        </div>

        {/* 상태 필터 */}
        <div className="mt-5 flex gap-1.5 overflow-x-auto sm:mt-6 sm:gap-2">
          {[
            "전체",
            "읽는 중",
            "완독",
            "안 읽음",
          ].map((item) => (
            <button
              key={item}
              onClick={() =>
                setFilter(item)
              }
              className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition sm:px-4 sm:py-2 ${
                filter === item
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* 최근 읽은 소설 */}
        {filter === "전체" && (
          <section className="mt-8 sm:mt-10">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold sm:text-lg">
                최근 읽은 소설
              </h3>
            </div>

            {loading ? (
              <div className="mt-3 rounded-2xl border bg-white px-5 py-10 text-center text-sm text-gray-400 sm:mt-4 sm:px-6 sm:py-12">
                서재를 불러오는 중...
              </div>
            ) : error ? (
              <div className="mt-3 rounded-2xl border bg-white px-5 py-10 text-center text-sm text-red-500 sm:mt-4 sm:px-6 sm:py-12">
                {error}
              </div>
            ) : recentBooks.length === 0 ? (
              <div className="mt-3 rounded-2xl border bg-white px-5 py-10 text-center text-sm text-gray-400 sm:mt-4 sm:px-6 sm:py-12">
                최근 읽은 소설이 없습니다.
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-3">
                {recentBooks.map(
                  (book) => (
                    <div
                      key={book.id}
                      className="block rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex w-9 shrink-0 flex-col items-center">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                            <BookOpen
                              className="h-4 w-4 text-gray-400"
                              strokeWidth={
                                1.75
                              }
                            />
                          </div>

                          <span
                            className={`mt-1.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-3 sm:text-[10px] ${statusStyle[getDisplayStatus(book)]}`}
                          >
                            {getDisplayStatus(
                              book
                            )}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="line-clamp-2 text-sm font-semibold leading-5 sm:text-[15px]">
                            {book.title}
                          </h4>

                          <div className="mt-1.5 flex items-center gap-2">
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                book.series_status ===
                                "completed"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-orange-50 text-orange-700"
                              }`}
                            >
                              {book.series_status ===
                              "completed"
                                ? "완결"
                                : "연재중"}
                            </span>

                            <p className="text-xs text-gray-400">
                              Google Drive
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">
                              {getRound(book)}
                              회독
                            </span>

                            <span className="text-gray-300">
                              ·
                            </span>

                            <span className="text-gray-500">
                              {getEpisode(book)}
                              화 /{" "}
                              {getEffectiveTotalEpisodes(
                                book
                              )}
                              화
                            </span>
                          </div>

                          <span className="font-medium">
                            {getProgress(book)}
                            %
                          </span>
                        </div>

                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${progressBarColor[book.status]}`}
                            style={{
                              width: `${getProgress(
                                book
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[11px] text-gray-400">
                          마지막 수정 ·{" "}
                          {new Date(
                            book.updated_at
                          ).toLocaleDateString(
                            "ko-KR"
                          )}
                        </span>

                        {renderAction(book)}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* 전체 소설 */}
        <section className="mt-10 sm:mt-12">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold sm:text-lg">
              전체 소설
            </h3>

            <button
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                setError("");

                try {
                  const response =
                    await fetch(
                      "/api/books/sync"
                    );

                  const data =
                    await response.json();

                  if (!response.ok) {
                    throw new Error(
                      typeof data?.error ===
                        "string"
                        ? data.error
                        : "동기화에 실패했습니다."
                    );
                  }

                  await loadBooks();
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "동기화 중 오류가 발생했습니다."
                  );
                } finally {
                  setSyncing(false);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 sm:px-3 sm:py-2 sm:text-sm"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                  syncing
                    ? "animate-spin"
                    : ""
                }`}
                strokeWidth={1.75}
              />

              {syncing
                ? "동기화 중..."
                : "새로고침"}
            </button>
          </div>

          {/* 검색 */}
          <div className="relative mt-4 sm:mt-5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={1.75}
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="소설 제목 검색"
              className="h-10 w-full rounded-xl border bg-white pl-9 pr-9 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 sm:h-11"
            />

            {search && (
              <button
                onClick={() =>
                  setSearch("")
                }
                aria-label="검색어 지우기"
                className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                />
              </button>
            )}
          </div>

          {/* 정렬 */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto text-xs sm:mt-4 sm:gap-2 sm:text-sm">
            <span className="shrink-0 text-gray-400">
              정렬
            </span>

            {(
              [
                {
                  key: "default",
                  label: "기본순",
                },
                {
                  key: "episodes",
                  label: "화수 많은순",
                },
                {
                  key: "title",
                  label: "가나다순",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() =>
                  changeSortOption(
                    opt.key
                  )
                }
                className={`shrink-0 rounded-full border px-3 py-1 font-medium transition ${
                  sortOption === opt.key
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 완결 / 미완 / 단편 / 중편 / 장편 / 초기화 */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto sm:mt-4 sm:gap-2">
            {TOGGLE_TAGS.map(
              (tag) => {
                const isActive =
                  activeTags.has(tag);

                const isCompletionTag =
                  COMPLETION_TAGS.includes(
                    tag
                  );

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      toggleTag(tag)
                    }
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition sm:px-3.5 sm:py-1.5 ${
                      isActive
                        ? isCompletionTag
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {tag}
                  </button>
                );
              }
            )}

            <button
              type="button"
              onClick={resetTags}
              disabled={
                activeTags.size === 0
              }
              className="ml-1 shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 disabled:cursor-default disabled:opacity-40 sm:px-3.5 sm:py-1.5"
            >
              초기화
            </button>
          </div>

          {/* 소설 목록 */}
          <div className="relative mt-3 overflow-hidden rounded-2xl border bg-white sm:mt-4">
            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400 sm:px-6 sm:py-12">
                불러오는 중...
              </div>
            ) : error ? (
              <div className="px-5 py-10 text-center text-sm text-red-500 sm:px-6 sm:py-12">
                {error}
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400 sm:px-6 sm:py-12">
                {search.trim()
                  ? "검색 결과가 없습니다."
                  : "표시할 소설이 없습니다."}
              </div>
            ) : (
              <>
                {/* 실제 스크롤 영역 */}
                <div
                  ref={bookListScrollRef}
                  className="custom-scrollbar max-h-[60vh] overflow-y-auto pr-4"
                >
                  {sortedBooks.map(
                    (book, index) => (
                      <div
                        key={book.id}
                        ref={(el) => {
                          bookRowRefs.current[
                            book.id
                          ] = el;
                        }}
                        className={`flex items-start gap-3 px-4 py-3.5 transition hover:bg-gray-50 sm:gap-4 sm:px-5 sm:py-4 ${
                          index !==
                          sortedBooks.length -
                            1
                            ? "border-b"
                            : ""
                        }`}
                      >
                        <div className="flex w-10 shrink-0 flex-col items-center sm:w-11">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 sm:h-10 sm:w-10">
                            <BookOpen
                              className="h-4 w-4 text-gray-400 sm:h-4.5 sm:w-4.5"
                              strokeWidth={
                                1.75
                              }
                            />
                          </div>

                          <span
                            className={`mt-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-3 sm:text-[10px] ${statusStyle[getDisplayStatus(book)]}`}
                          >
                            {getDisplayStatus(
                              book
                            )}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="line-clamp-2 text-sm font-medium leading-5 sm:text-[15px]">
                              {book.title}
                            </h4>

                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                book.series_status ===
                                "completed"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-orange-50 text-orange-700"
                              }`}
                            >
                              {book.series_status ===
                              "completed"
                                ? "완결"
                                : "연재중"}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600">
                              {getRound(book)}
                              회독
                            </span>

                            <span className="text-xs text-gray-300">
                              ·
                            </span>

                            <span className="text-xs text-gray-400">
                              {getEpisode(book)}
                              화 ·{" "}
                              {getProgress(book)}
                              %
                            </span>
                          </div>

                          <div className="mt-2 h-1 w-full max-w-40 overflow-hidden rounded-full bg-gray-100 sm:hidden">
                            <div
                              className={`h-full rounded-full ${progressBarColor[book.status]}`}
                              style={{
                                width: `${getProgress(
                                  book
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="hidden w-28 shrink-0 sm:block">
                          <div className="flex justify-between text-[11px] text-gray-400">
                            <span>
                              진행률
                            </span>

                            <span>
                              {getProgress(book)}
                              %
                            </span>
                          </div>

                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full ${progressBarColor[book.status]}`}
                              style={{
                                width: `${getProgress(
                                  book
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        {renderAction(
                          book,
                          true
                        )}
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            {/* =====================================================
                모바일 커스텀 스크롤바

                track은 항상 DOM에 존재시킨다.
                그래야 최초 렌더링 때도 scrollThumb을 계산할 수 있다.
               ===================================================== */}
            {!loading &&
              !error &&
              filteredBooks.length > 0 && (
                <div
                  ref={scrollBarRef}
                  className="absolute inset-y-2.5 right-1.5 z-20 w-3 touch-none sm:hidden"
                >
                  {scrollThumb.height > 0 && (
                    <div
                      className="absolute left-0 w-3 touch-none rounded-full bg-gray-400/90 shadow-sm"
                      style={{
                        height: `${scrollThumb.height}px`,
                        transform: `translateY(${scrollThumb.top}px)`,
                      }}
                      onPointerDown={
                        handleScrollThumbPointerDown
                      }
                      onPointerMove={
                        handleScrollThumbPointerMove
                      }
                      onPointerUp={
                        handleScrollThumbPointerUp
                      }
                      onPointerCancel={
                        handleScrollThumbPointerUp
                      }
                    />
                  )}
                </div>
              )}

            {/* 자모/알파벳 인덱스 바 */}
            {availableIndexLetters.length >
              0 &&
              filteredBooks.length > 20 && (
                <div className="pointer-events-none absolute inset-y-3 left-1 z-10 flex items-center sm:left-1.5">
                  <div className="pointer-events-auto flex max-h-full flex-col items-center gap-0.5 overflow-y-auto rounded-full bg-white/80 px-0.5 py-1.5 text-[9px] font-medium text-gray-400 shadow-sm backdrop-blur [scrollbar-width:none] sm:text-[10px] [&::-webkit-scrollbar]:hidden">
                    {availableIndexLetters.map(
                      (letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() =>
                            jumpToIndex(
                              letter
                            )
                          }
                          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-900 hover:text-white sm:h-4 sm:w-4"
                        >
                          {letter}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        </section>
      </section>

      {/* 맨 위로 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="맨 위로"
          className="fixed bottom-20 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border bg-white text-gray-600 shadow-md transition hover:bg-gray-50 hover:text-gray-900 sm:bottom-24 sm:right-8 sm:h-11 sm:w-11"
        >
          <ArrowUp
            className="h-4 w-4 sm:h-5 sm:w-5"
            strokeWidth={1.75}
          />
        </button>
      )}
    </main>
  );
}