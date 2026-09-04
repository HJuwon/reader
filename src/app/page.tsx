"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bookmark,
  Highlighter,
  History,
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

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("전체");
  const [search, setSearch] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

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
    async function initializeBooks() {
      try {
        // Google Drive와 DB를 비교해서
        // DB에 없는 새 TXT 파일만 추가
        await fetch("/api/books/sync");

        // 동기화가 끝난 뒤 DB의 최신 목록을 가져옴
        await loadBooks();
      } catch (error) {
        console.error("책 동기화 실패:", error);

        // 동기화가 실패하더라도
        // 기존 DB 목록은 보여주도록 함
        await loadBooks();
      }
    }

    initializeBooks();
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

  // 상태 필터 + 제목 검색
  const filteredBooks = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesStatus =
        filter === "전체" || book.status === filter;

      const matchesSearch =
        keyword === "" ||
        book.title.toLowerCase().includes(keyword);

      return matchesStatus && matchesSearch;
    });
  }, [books, filter, search]);

  // 최근 읽은 소설
  // 진행률이 0보다 크고 100보다 작은 소설만 표시
  const recentBooks = useMemo(() => {
    return [...books]
      .filter(
        (book) =>
          book.progress > 0 &&
          book.progress < 100
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime()
      )
      .slice(0, 6);
  }, [books]);

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <BookOpen
              className="h-4.5 w-4.5 text-gray-900"
              strokeWidth={1.75}
            />

            <h1 className="text-base font-semibold">
              Reader
            </h1>
          </div>

          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
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
              <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentBooks.map((book) => (
                  <Link
                    key={book.id}
                    href={`/drive?fileId=${encodeURIComponent(
                      book.drive_file_id
                    )}&fileName=${encodeURIComponent(
                      book.title
                    )}`}
                    className="block rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      {/* 작은 아이콘 */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        <BookOpen
                          className="h-4 w-4 text-gray-400"
                          strokeWidth={1.75}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="line-clamp-2 text-sm font-semibold leading-5 sm:text-base">
                          {book.title}
                        </h4>

                        <p className="mt-1.5 text-xs text-gray-400">
                          Google Drive
                        </p>

                        {/* 상태를 제목 아래로 이동 */}
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle[book.status]}`}
                        >
                          {book.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-500">
                          {book.last_episode > 0
                            ? `${book.last_episode}화`
                            : "1화"}{" "}
                          / {book.total_episodes}화
                        </span>

                        <span className="font-medium">
                          {book.progress}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${progressBarColor[book.status]}`}
                          style={{
                            width: `${book.progress}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        마지막 수정 ·{" "}
                        {new Date(
                          book.updated_at
                        ).toLocaleDateString("ko-KR")}
                      </span>

                      <span className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white">
                        이어 읽기
                      </span>
                    </div>
                  </Link>
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
              onClick={async () => {
                await fetch("/api/books/sync");
                await loadBooks();
              }}
              className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 sm:px-3 sm:py-2 sm:text-sm"
            >
              <RotateCcw
                className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                strokeWidth={1.75}
              />

              새로고침
            </button>
          </div>

          {/* 소설 검색 */}
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

          {/* 검색 결과 수 */}
          {search.trim() && !loading && !error && (
            <p className="mt-2 text-xs text-gray-400">
              {filteredBooks.length}개의 소설
            </p>
          )}

          {/* 소설 목록 - 내부 스크롤 */}
          <div className="mt-3 overflow-hidden rounded-2xl border bg-white sm:mt-4">
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
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredBooks.map((book, index) => (
                  <div
                    key={book.id}
                    className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-gray-50 sm:gap-4 sm:px-5 sm:py-4 ${
                      index !==
                      filteredBooks.length - 1
                        ? "border-b"
                        : ""
                    }`}
                  >
                    {/* 아이콘 축소 */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 sm:h-10 sm:w-10">
                      <BookOpen
                        className="h-4 w-4 text-gray-400 sm:h-4.5 sm:w-4.5"
                        strokeWidth={1.75}
                      />
                    </div>

                    {/* 제목 + 상태 + 회차 */}
                    <div className="min-w-0 flex-1">
                      <h4 className="line-clamp-2 text-sm font-medium leading-5 sm:text-[15px]">
                        {book.title}
                      </h4>

                      {/* 상태를 제목 밑으로 이동 */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-[11px] ${statusStyle[book.status]}`}
                        >
                          {book.status}
                        </span>

                        <span className="text-xs text-gray-400">
                          {book.last_episode > 0
                            ? `${book.last_episode}화`
                            : "1화"}{" "}
                          · {book.progress}%
                        </span>
                      </div>

                      {/* 모바일 진행률 */}
                      <div className="mt-2 h-1 w-full max-w-40 overflow-hidden rounded-full bg-gray-100 sm:hidden">
                        <div
                          className={`h-full rounded-full ${progressBarColor[book.status]}`}
                          style={{
                            width: `${book.progress}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 데스크톱 진행률 */}
                    <div className="hidden w-28 shrink-0 sm:block">
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>진행률</span>

                        <span>
                          {book.progress}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${progressBarColor[book.status]}`}
                          style={{
                            width: `${book.progress}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 보기 */}
                    <Link
                      href={`/drive?fileId=${encodeURIComponent(
                        book.drive_file_id
                      )}&fileName=${encodeURIComponent(
                        book.title
                      )}`}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 sm:px-3 sm:py-2 sm:text-sm"
                    >
                      보기
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      {/* 맨 위로 버튼 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="맨 위로"
          className="fixed bottom-20 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border bg-white text-gray-600 shadow-md transition hover:bg-gray-50 hover:text-gray-900 sm:bottom-24 sm:right-8 sm:h-11 sm:w-11"
        >
          <ArrowUp
            className="h-4.5 w-4.5 sm:h-5 sm:w-5"
            strokeWidth={1.75}
          />
        </button>
      )}

      {/* 하단 네비게이션 */}
      <nav className="sticky bottom-0 border-t bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-2.5 sm:py-3">
          <button className="flex flex-col items-center gap-1 text-xs font-medium text-gray-900 sm:text-sm">
            <BookOpen
              className="h-4.5 w-4.5 sm:h-5 sm:w-5"
              strokeWidth={1.75}
            />

            <span>서재</span>
          </button>

          <Link
            href="/bookmarks"
            className="flex flex-col items-center gap-1 text-xs text-gray-400 transition hover:text-gray-900 sm:text-sm"
          >
            <Bookmark
              className="h-4.5 w-4.5 sm:h-5 sm:w-5"
              strokeWidth={1.75}
            />

            <span>북마크</span>
          </Link>

          <Link
            href="/highlights"
            className="flex flex-col items-center gap-1 text-xs text-gray-400 transition hover:text-gray-900 sm:text-sm"
          >
            <Highlighter
              className="h-4.5 w-4.5 sm:h-5 sm:w-5"
              strokeWidth={1.75}
            />

            <span>하이라이트</span>
          </Link>

          <Link
            href="/history"
            className="flex flex-col items-center gap-1 text-xs text-gray-400 transition hover:text-gray-900 sm:text-sm"
          >
            <History
              className="h-4.5 w-4.5 sm:h-5 sm:w-5"
              strokeWidth={1.75}
            />

            <span>읽기 이력</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const filteredBooks =
    filter === "전체"
      ? books
      : books.filter((book) => book.status === filter);

  // 최근 읽은 소설
  // 진행률이 0보다 크고 100보다 작은 소설만 표시
  const recentBooks = books
    .filter(
      (book) =>
        book.progress > 0 &&
        book.progress < 100
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
    );

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpen
              className="h-5 w-5 text-gray-900"
              strokeWidth={1.75}
            />

            <h1 className="text-lg font-semibold">
              Reader
            </h1>
          </div>

          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            내 서재
          </h2>

          <p className="mt-2 text-gray-500">
            내가 읽고 있는 웹소설을 관리하세요.
          </p>
        </div>

        <div className="mt-8 flex gap-2 overflow-x-auto">
          {[
            "전체",
            "읽는 중",
            "완독",
            "안 읽음",
          ].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
                filter === item
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* 전체 탭에서만 최근 읽은 소설 표시 */}
        {filter === "전체" && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                최근 읽은 소설
              </h3>
            </div>

            {loading ? (
              <div className="mt-4 rounded-2xl border bg-white px-6 py-12 text-center text-sm text-gray-400">
                서재를 불러오는 중...
              </div>
            ) : error ? (
              <div className="mt-4 rounded-2xl border bg-white px-6 py-12 text-center text-sm text-red-500">
                {error}
              </div>
            ) : recentBooks.length === 0 ? (
              <div className="mt-4 rounded-2xl border bg-white px-6 py-12 text-center text-sm text-gray-400">
                최근 읽은 소설이 없습니다.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentBooks.map((book) => (
                  <Link
                    key={book.id}
                    href={`/drive?fileId=${encodeURIComponent(
                      book.drive_file_id
                    )}&fileName=${encodeURIComponent(
                      book.title
                    )}`}
                    className="block rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold">
                          {book.title}
                        </h4>

                        <p className="mt-1 text-sm text-gray-400">
                          Google Drive
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[book.status]}`}
                      >
                        {book.status}
                      </span>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {book.last_episode > 0
                            ? `${book.last_episode}화`
                            : "1화"}{" "}
                          / {book.total_episodes}화
                        </span>

                        <span className="font-medium">
                          {book.progress}%
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${progressBarColor[book.status]}`}
                          style={{
                            width: `${book.progress}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        마지막 수정 ·{" "}
                        {new Date(
                          book.updated_at
                        ).toLocaleDateString("ko-KR")}
                      </span>

                      <span className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">
                        이어 읽기
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 내 소설 */}
        <section
          className={
            filter === "전체"
              ? "mt-12"
              : "mt-10"
          }
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              내 소설
            </h3>

            <button
              onClick={async () => {
                await fetch("/api/books/sync");
                await loadBooks();
              }}
              className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw
                className="h-4 w-4"
                strokeWidth={1.75}
              />

              새로고침
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
            {loading ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">
                불러오는 중...
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center text-sm text-red-500">
                {error}
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">
                표시할 소설이 없습니다.
              </div>
            ) : (
              filteredBooks.map((book, index) => (
                <div
                  key={book.id}
                  className={`flex items-center gap-4 p-5 transition hover:bg-gray-50 ${
                    index !==
                    filteredBooks.length - 1
                      ? "border-b"
                      : ""
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <BookOpen
                      className="h-5 w-5 text-gray-400"
                      strokeWidth={1.75}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate font-medium">
                        {book.title}
                      </h4>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[book.status]}`}
                      >
                        {book.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-400">
                      {book.last_episode > 0
                        ? `${book.last_episode}화`
                        : "1화"}
                      {" · "}
                      {book.progress}%
                    </p>

                    <div className="mt-2 h-1 w-full max-w-40 overflow-hidden rounded-full bg-gray-100 sm:hidden">
                      <div
                        className={`h-full rounded-full ${progressBarColor[book.status]}`}
                        style={{
                          width: `${book.progress}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="hidden w-32 sm:block">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>진행률</span>

                      <span>
                        {book.progress}%
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${progressBarColor[book.status]}`}
                        style={{
                          width: `${book.progress}%`,
                        }}
                      />
                    </div>
                  </div>

                  <Link
                    href={`/drive?fileId=${encodeURIComponent(
                      book.drive_file_id
                    )}&fileName=${encodeURIComponent(
                      book.title
                    )}`}
                    className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                  >
                    보기
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      {/* 맨 위로 버튼 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="맨 위로"
          className="fixed bottom-20 right-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border bg-white text-gray-600 shadow-md transition hover:bg-gray-50 hover:text-gray-900 sm:bottom-24 sm:right-8"
        >
          <ArrowUp
            className="h-5 w-5"
            strokeWidth={1.75}
          />
        </button>
      )}

      {/* 하단 네비게이션 */}
      <nav className="sticky bottom-0 border-t bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-3">
          <button className="flex flex-col items-center gap-1 text-sm font-medium text-gray-900">
            <BookOpen
              className="h-5 w-5"
              strokeWidth={1.75}
            />

            <span>서재</span>
          </button>

          <Link
            href="/bookmarks"
            className="flex flex-col items-center gap-1 text-sm text-gray-400 hover:text-gray-900"
          >
            <Bookmark
              className="h-5 w-5"
              strokeWidth={1.75}
            />

            <span>북마크</span>
          </Link>

          <Link
            href="/highlights"
            className="flex flex-col items-center gap-1 text-sm text-gray-400 hover:text-gray-900"
          >
            <Highlighter
              className="h-5 w-5"
              strokeWidth={1.75}
            />

            <span>하이라이트</span>
          </Link>

          <Link
            href="/history"
            className="flex flex-col items-center gap-1 text-sm text-gray-400 hover:text-gray-900"
          >
            <History
              className="h-5 w-5"
              strokeWidth={1.75}
            />

            <span>읽기 이력</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
