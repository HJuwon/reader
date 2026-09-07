"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

  // 회독 정보
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

// 한글 초성 19개 (완성형 한글 유니코드 계산용)
const CHOSUNG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

// 된소리 초성(ㄲㄸㅃㅆㅉ)은 인덱스 바에서 자연스럽게 같은 그룹으로 묶어서 보여줌
const CHOSUNG_GROUP: Record<string, string> = {
  "ㄱ": "ㄱ", "ㄲ": "ㄱ",
  "ㄴ": "ㄴ",
  "ㄷ": "ㄷ", "ㄸ": "ㄷ",
  "ㄹ": "ㄹ",
  "ㅁ": "ㅁ",
  "ㅂ": "ㅂ", "ㅃ": "ㅂ",
  "ㅅ": "ㅅ", "ㅆ": "ㅅ",
  "ㅇ": "ㅇ",
  "ㅈ": "ㅈ", "ㅉ": "ㅈ",
  "ㅊ": "ㅊ",
  "ㅋ": "ㅋ",
  "ㅌ": "ㅌ",
  "ㅍ": "ㅍ",
  "ㅎ": "ㅎ",
};

// 인덱스 바에 표시될 전체 순서 (자모 → 알파벳 → 기타)
const INDEX_ORDER = [
  "ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "#",
];

// 제목 끝에 보통 "1-120" 처럼 붙어있는 화수 범위에서 총 화수(뒤쪽 숫자)를 추출
// (새로 동기화된 책은 파일을 한 번 열어보기 전까지 total_episodes가 0이라
//  제목에 적힌 범위로 화수를 추정해서 "화수 많은순" 정렬에 사용한다)
function getTitleEpisodeCount(title: string): number {
  const matches = [...title.matchAll(/(\d+)\s*[-~]\s*(\d+)/g)];

  if (matches.length === 0) {
    return 0;
  }

  // 제목 안에 숫자 범위가 여러 개 있을 수도 있으니 가장 마지막(보통 맨 뒤) 것을 사용
  const last = matches[matches.length - 1];
  const count = parseInt(last[2], 10);

  return Number.isFinite(count) ? count : 0;
}

// DB에 기록된 total_episodes와 제목에서 추정한 화수 중 더 큰 값을 사용
function getEffectiveTotalEpisodes(book: Book): number {
  return Math.max(book.total_episodes || 0, getTitleEpisodeCount(book.title));
}

// 화수 구간 (단편 / 중편 / 장편) + 완결 여부를 하나의 토글 그룹으로 묶어서 사용
const TOGGLE_TAGS = ["완결", "미완", "단편", "중편", "장편"] as const;
type ToggleTag = (typeof TOGGLE_TAGS)[number];

// 완결 여부 태그 / 화수 구간 태그를 구분 (같은 그룹끼리는 OR, 그룹 간에는 AND로 필터링)
const COMPLETION_TAGS: ToggleTag[] = ["완결", "미완"];
const LENGTH_TAGS: ToggleTag[] = ["단편", "중편", "장편"];

// 화수 기준으로 단편(500화 미만) / 중편(500~1000화) / 장편(1000화 초과)으로 분류
function getLengthBucket(book: Book): "단편" | "중편" | "장편" {
  const total = getEffectiveTotalEpisodes(book);

  if (total > 1000) return "장편";
  if (total >= 500) return "중편";
  return "단편";
}

// 제목의 첫 글자를 기준으로 인덱스 바 그룹 키를 구한다
function getIndexKey(title: string): string {
  const trimmed = title.trim();

  if (!trimmed) {
    return "#";
  }

  const code = trimmed.charCodeAt(0);

  // 완성형 한글 (가 ~ 힣)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const choIndex = Math.floor((code - 0xac00) / (21 * 28));
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
  // 완결/미완 + 화수 구간(단편/중편/장편)을 하나의 토글 그룹으로 관리
  // (여러 개를 동시에 켤 수 있는 멀티 토글: 같은 그룹끼리는 OR, 그룹 간에는 AND)
  const [activeTags, setActiveTags] = useState<Set<ToggleTag>>(
    () => new Set()
  );
  // 정렬 기준: 기본(불러온 순서) / 화수 많은순 / 가나다순
  const [sortOption, setSortOption] = useState<
    "default" | "episodes" | "title"
  >("default");
  const [search, setSearch] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 자모/알파벳 인덱스 바로 점프할 때, 각 소설 행의 DOM을 참조
  const bookRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 토글 태그(완결/미완/단편/중편/장편) 켜고 끄기
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

  async function loadBooks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/books");

      const data = await response.json();

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
    // 페이지 로드(새로고침) 시에는 DB만 조회한다.
    // 구글 드라이브 동기화는 "새로고침" 버튼을 눌렀을 때만 실행된다.
    loadBooks();
  }, []);

  // 스크롤 위치에 따라 맨 위로 버튼 표시
  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 400);
    }

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // 상태 필터 + 완결 여부 필터 + 제목 검색
  const filteredBooks = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesStatus =
        filter === "전체" ||
        getDisplayStatus(book) === filter;

      const activeCompletionTags = COMPLETION_TAGS.filter((tag) =>
        activeTags.has(tag)
      );

      const matchesCompletion =
        activeCompletionTags.length === 0 ||
        activeCompletionTags.some(
          (tag) =>
            (tag === "완결" &&
              book.series_status === "completed") ||
            (tag === "미완" && book.series_status === "ongoing")
        );

      const activeLengthTags = LENGTH_TAGS.filter((tag) =>
        activeTags.has(tag)
      );

      const matchesLength =
        activeLengthTags.length === 0 ||
        activeLengthTags.includes(getLengthBucket(book));

      const matchesSearch =
        keyword === "" ||
        book.title.toLowerCase().includes(keyword);

      return (
        matchesStatus &&
        matchesCompletion &&
        matchesLength &&
        matchesSearch
      );
    });
  }, [books, filter, activeTags, search]);

  // 정렬 적용 (화수 많은순 / 가나다순 / 기본)
  const sortedBooks = useMemo(() => {
    const list = [...filteredBooks];

    if (sortOption === "episodes") {
      list.sort(
        (a, b) =>
          getEffectiveTotalEpisodes(b) - getEffectiveTotalEpisodes(a)
      );
    } else if (sortOption === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    }

    return list;
  }, [filteredBooks, sortOption]);

  // 정렬된 목록 기준으로, 인덱스 바의 각 글자에 해당하는 첫 번째 소설을 찾는다
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

  // 실제로 목록에 존재하는 글자만 인덱스 바에 노출
  const availableIndexLetters = useMemo(
    () => INDEX_ORDER.filter((letter) => indexAnchors.has(letter)),
    [indexAnchors]
  );

  // 인덱스 글자 클릭 → 가나다순 정렬로 전환하고 해당 위치로 스크롤
  // (정렬을 바꿔도 목록의 행 자체는 그대로 유지되고 순서만 바뀌므로,
  //  가나다순 기준 위치를 먼저 계산해 바로 스크롤할 수 있다)
  function jumpToIndex(letter: string) {
    const titleSorted = [...filteredBooks].sort((a, b) =>
      a.title.localeCompare(b.title, "ko")
    );

    const target = titleSorted.find(
      (book) => getIndexKey(book.title) === letter
    );

    setSortOption("title");

    if (target) {
      bookRowRefs.current[target.id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    }
  }

  // 최근 읽은 소설
  const recentBooks = useMemo(() => {
    return [...books]
      .filter(
        (book) =>
          book.status === "읽는 중" ||
          (book.progress > 0 && book.progress < 100)
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime()
      )
      .slice(0, 3);
  }, [books]);

  // 리더 이동 URL
  function getReaderUrl(book: Book) {
    return `/drive?fileId=${encodeURIComponent(
      book.drive_file_id
    )}&fileName=${encodeURIComponent(book.title)}`;
  }

  // 다시 읽기
  // 완독 상태에서 새로운 회독을 만들고 1화부터 시작
  async function restartReading(book: Book) {
    if (book.status !== "완독") {
      return;
    }

    try {
      setError("");

      const response = await fetch("/api/books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          drive_file_id: book.drive_file_id,
          title: book.title,
          total_episodes: book.total_episodes,
          restart: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "다시 읽기를 시작하지 못했습니다."
        );
      }

      // 새 회독 상태를 먼저 반영
      await loadBooks();

      // 새 회독은 1화부터 리더 진입
      window.location.href = getReaderUrl(book);
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

  // 회독 번호
  function getRound(book: Book) {
    return book.current_round ?? book.round_count ?? 1;
  }

  // 현재 에피소드
  function getEpisode(book: Book) {
    if (
      book.current_episode !== null &&
      book.current_episode !== undefined &&
      book.current_episode > 0
    ) {
      return book.current_episode;
    }

    if (book.last_episode > 0) {
      return book.last_episode;
    }

    return 1;
  }

  // 현재 진행률
  function getProgress(book: Book) {
    return book.current_progress ?? book.progress ?? 0;
  }

  // 화면에 보여줄 상태 배지
  // 한 번이라도 완독한 적이 있으면, 다시 읽는 중이어도
  // 배지는 계속 "완독"으로 유지한다. (회독수만 올라감)
  function getDisplayStatus(book: Book) {
    if ((book.completed_round_count ?? 0) > 0) {
      return "완독";
    }

    return book.status;
  }

  // 버튼
  function renderAction(book: Book, compact = false) {
    const commonClass = compact
      ? "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm"
      : "rounded-lg px-2.5 py-1.5 text-xs font-medium transition";

    // 완독 → 다시 읽기
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

    // 안 읽음 → 읽기 시작
    if (book.status === "안 읽음") {
      return (
        <Link
          href={getReaderUrl(book)}
          onClick={(event) => event.stopPropagation()}
          className={`${commonClass} bg-gray-900 text-white hover:bg-gray-800`}
        >
          읽기 시작
        </Link>
      );
    }

    // 읽는 중 → 이어읽기
    return (
      <Link
        href={getReaderUrl(book)}
        onClick={(event) => event.stopPropagation()}
        className={`${commonClass} bg-blue-600 text-white hover:bg-blue-700`}
      >
        이어읽기
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* 상단 헤더 */}
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
        {/* 페이지 제목 */}
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            내 서재
          </h2>

          <p className="mt-1.5 text-sm text-gray-500 sm:text-base">
            내가 읽고 있는 웹소설을 관리하세요.
          </p>
        </div>

        {/* 상태 필터 */}
        <div className="mt-6 flex gap-1.5 overflow-x-auto sm:mt-8 sm:gap-2">
          {[
            "전체",
            "읽는 중",
            "완독",
            "안 읽음",
          ].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
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

        {/* 완결/미완 + 화수 구간(단편/중편/장편) 토글 — 여러 개 동시 선택 가능 */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto sm:mt-3 sm:gap-2">
          {TOGGLE_TAGS.map((tag) => {
            const isActive = activeTags.has(tag);
            const isCompletionTag = COMPLETION_TAGS.includes(tag);

            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
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
          })}
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
                {recentBooks.map((book) => (
                  <div
                    key={book.id}
                    className="block rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                  >
                    {/* 아이콘 + 상태 + 제목 */}
                    <div className="flex items-start gap-3">
                      <div className="flex w-9 shrink-0 flex-col items-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                          <BookOpen
                            className="h-4 w-4 text-gray-400"
                            strokeWidth={1.75}
                          />
                        </div>

                        <span
                          className={`mt-1.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-3 sm:text-[10px] ${statusStyle[getDisplayStatus(book)]}`}
                        >
                          {getDisplayStatus(book)}
                        </span>
                      </div>

                      {/* 제목 */}
                      <div className="min-w-0 flex-1">
                        <h4 className="line-clamp-2 text-sm font-semibold leading-5 sm:text-[15px]">
                          {book.title}
                        </h4>

                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              book.series_status === "completed"
                                ? "bg-purple-50 text-purple-700"
                                : "bg-orange-50 text-orange-700"
                            }`}
                          >
                            {book.series_status === "completed" ? "완결" : "연재중"}
                          </span>

                          <p className="text-xs text-gray-400">
                            Google Drive
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 회독 + 진행률 */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700">
                            {getRound(book)}회독
                          </span>

                          <span className="text-gray-300">
                            ·
                          </span>

                          <span className="text-gray-500">
                            {getEpisode(book)}화 /{" "}
                            {getEffectiveTotalEpisodes(book)}화
                          </span>
                        </div>

                        <span className="font-medium">
                          {getProgress(book)}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${progressBarColor[book.status]}`}
                          style={{
                            width: `${getProgress(book)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 하단 */}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        마지막 수정 ·{" "}
                        {new Date(
                          book.updated_at
                        ).toLocaleDateString("ko-KR")}
                      </span>

                      {renderAction(book)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 내 소설 */}
        <section
          className={
            filter === "전체"
              ? "mt-10 sm:mt-12"
              : "mt-8 sm:mt-10"
          }
        >
          {/* 제목 + 새로고침 */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold sm:text-lg">
              내 소설
            </h3>


            <button
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                setError("");

                try {
                  const response = await fetch("/api/books/sync");
                  const data = await response.json();

                  if (!response.ok) {
                    throw new Error(
                      typeof data?.error === "string"
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
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${syncing ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />

              {syncing ? "동기화 중..." : "새로고침"}
            </button>
            
          </div>

          {/* 검색창 */}
          <div className="relative mt-3 sm:mt-4">
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
                onClick={() => setSearch("")}
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

          {/* 정렬 기준 */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto text-xs sm:mt-4 sm:gap-2 sm:text-sm">
            <span className="shrink-0 text-gray-400">정렬</span>

            {(
              [
                { key: "default", label: "기본순" },
                { key: "episodes", label: "화수 많은순" },
                { key: "title", label: "가나다순" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortOption(opt.key)}
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

          {/* 검색 결과 수 */}
          {search.trim() && !loading && !error && (
            <p className="mt-2 text-xs text-gray-400">
              {filteredBooks.length}개의 소설
            </p>
          )}

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
              <div className="custom-scrollbar max-h-[60vh] overflow-y-auto">
                {sortedBooks.map((book, index) => (
                  <div
                    key={book.id}
                    ref={(el) => {
                      bookRowRefs.current[book.id] = el;
                    }}
                    className={`flex items-start gap-3 px-4 py-3.5 transition hover:bg-gray-50 sm:gap-4 sm:px-5 sm:py-4 ${
                      index !==
                      sortedBooks.length - 1
                        ? "border-b"
                        : ""
                    }`}
                  >
                    {/* 아이콘 + 상태 */}
                    <div className="flex w-10 shrink-0 flex-col items-center sm:w-11">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 sm:h-10 sm:w-10">
                        <BookOpen
                          className="h-4 w-4 text-gray-400 sm:h-4.5 sm:w-4.5"
                          strokeWidth={1.75}
                        />
                      </div>

                      <span
                        className={`mt-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-3 sm:text-[10px] ${statusStyle[getDisplayStatus(book)]}`}
                      >
                        {getDisplayStatus(book)}
                      </span>
                    </div>

                    {/* 제목 + 회독 + 진행률 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="line-clamp-2 text-sm font-medium leading-5 sm:text-[15px]">
                          {book.title}
                        </h4>

                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            book.series_status === "completed"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {book.series_status === "completed" ? "완결" : "연재중"}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">
                          {getRound(book)}회독
                        </span>

                        <span className="text-xs text-gray-300">
                          ·
                        </span>

                        <span className="text-xs text-gray-400">
                          {getEpisode(book)}화 ·{" "}
                          {getProgress(book)}%
                        </span>
                      </div>

                      {/* 모바일 진행률 */}
                      <div className="mt-2 h-1 w-full max-w-40 overflow-hidden rounded-full bg-gray-100 sm:hidden">
                        <div
                          className={`h-full rounded-full ${progressBarColor[book.status]}`}
                          style={{
                            width: `${getProgress(book)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 데스크톱 진행률 */}
                    <div className="hidden w-28 shrink-0 sm:block">
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>진행률</span>

                        <span>
                          {getProgress(book)}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${progressBarColor[book.status]}`}
                          style={{
                            width: `${getProgress(book)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 상태별 버튼 */}
                    {renderAction(book, true)}
                  </div>
                ))}
              </div>
            )}

            {/* 자모/알파벳 인덱스 바 (목록이 많을 때만 노출) */}
            {availableIndexLetters.length > 0 &&
              filteredBooks.length > 20 && (
                <div className="pointer-events-none absolute inset-y-3 right-1 z-10 flex items-center sm:right-1.5">
                  <div className="pointer-events-auto flex max-h-full flex-col items-center gap-0.5 overflow-y-auto rounded-full bg-white/80 px-0.5 py-1.5 text-[9px] font-medium text-gray-400 shadow-sm backdrop-blur [scrollbar-width:none] sm:text-[10px] [&::-webkit-scrollbar]:hidden">
                    {availableIndexLetters.map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => jumpToIndex(letter)}
                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-900 hover:text-white sm:h-4 sm:w-4"
                      >
                        {letter}
                      </button>
                    ))}
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