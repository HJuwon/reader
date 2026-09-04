"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Bookmark,
  Highlighter,
  History,
  RotateCcw,
  ArrowUp,
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