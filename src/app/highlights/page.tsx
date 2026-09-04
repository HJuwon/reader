"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Highlighter,
} from "lucide-react";

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

type BookItem = {
  id: string;
  drive_file_id: string;
  title: string;
  total_episodes: number;
  last_episode: number;
  progress: number;
  status: string;
};

export default function HighlightsPage() {
  const [highlights, setHighlights] =
    useState<HighlightItem[]>([]);

  const [books, setBooks] =
    useState<BookItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  // =========================================================
  // 하이라이트 + 책 정보 불러오기
  // =========================================================

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [
          highlightsResponse,
          booksResponse,
        ] = await Promise.all([
          fetch("/api/highlights"),
          fetch("/api/books"),
        ]);

        const highlightsData =
          await highlightsResponse.json();

        const booksData =
          await booksResponse.json();

        if (!highlightsResponse.ok) {
          throw new Error(
            highlightsData?.error ||
              "하이라이트를 불러오지 못했습니다."
          );
        }

        if (!booksResponse.ok) {
          throw new Error(
            booksData?.error ||
              "책 정보를 불러오지 못했습니다."
          );
        }

        setHighlights(
          highlightsData.data || []
        );

        setBooks(
          booksData.data || []
        );
      } catch (error) {
        console.error(
          "하이라이트 목록 불러오기 실패:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "하이라이트를 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // =========================================================
  // 책 제목 찾기
  // =========================================================

  function getBookTitle(
    bookId: string
  ) {
    const book = books.find(
      (item) =>
        item.id === bookId
    );

    return (
      book?.title ||
      "알 수 없는 소설"
    );
  }

  // =========================================================
  // 하이라이트 삭제
  // =========================================================

  async function deleteHighlight(
    id: string
  ) {
    if (deletingId) {
      return;
    }

    setDeletingId(id);

    try {
      const response =
        await fetch(
          `/api/highlights?id=${encodeURIComponent(
            id
          )}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "하이라이트를 삭제하지 못했습니다."
        );
      }

      setHighlights(
        (current) =>
          current.filter(
            (highlight) =>
              highlight.id !== id
          )
      );
    } catch (error) {
      console.error(
        "하이라이트 삭제 실패:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "하이라이트를 삭제하지 못했습니다."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // =========================================================
  // 날짜 표시
  // =========================================================

  function formatDate(
    dateString: string
  ) {
    const date =
      new Date(dateString);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toLocaleDateString(
      "ko-KR",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
  }

  // =========================================================
  // 로딩 화면
  // =========================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fafaf8]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5">
          <div className="flex items-center gap-2 text-sm text-[#a3a39a]">
            <Loader2 className="h-5 w-5 animate-spin" />
            하이라이트를 불러오는 중...
          </div>
        </div>
      </main>
    );
  }

  // =========================================================
  // 오류 화면
  // =========================================================

  if (error) {
    return (
      <main className="min-h-screen bg-[#fafaf8]">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <header className="py-6 md:py-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-[#a3a39a] hover:text-[#45453f]"
            >
              <ArrowLeft className="h-4 w-4" />
              서재로 돌아가기
            </Link>
          </header>

          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-[#45453f]">
                {error}
              </p>

              <button
                onClick={() =>
                  window.location.reload()
                }
                className="mt-5 text-sm text-[#a3a39a] hover:text-[#45453f]"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================
  // 메인 화면
  // =========================================================

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#1e1e1c]">
      <div className="mx-auto max-w-3xl px-5 pb-24 md:px-8">
        {/* ===================================================
            상단
        ==================================================== */}

        <header className="py-6 md:py-8">
          <Link
            href="/"
            className="mb-5 flex items-center gap-2 text-sm text-[#a3a39a] hover:text-[#45453f]"
          >
            <ArrowLeft className="h-4 w-4" />
            서재
          </Link>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-serif text-2xl font-medium tracking-tight">
                하이라이트
              </h1>

              <p className="mt-2 text-sm text-[#a3a39a]">
                저장한 문장을 모아볼 수 있습니다.
              </p>
            </div>

            {highlights.length > 0 && (
              <p className="text-xs text-[#a3a39a]">
                {highlights.length}개
              </p>
            )}
          </div>
        </header>

        {/* ===================================================
            하이라이트 없음
        ==================================================== */}

        {highlights.length === 0 ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="text-center">
              <Highlighter className="mx-auto h-8 w-8 text-[#c8c8bf]" />

              <p className="mt-4 text-sm text-[#45453f]">
                저장한 하이라이트가 없습니다.
              </p>

              <p className="mt-2 text-xs leading-6 text-[#a3a39a]">
                소설을 읽다가 문장을 드래그하면
                하이라이트로 저장할 수 있습니다.
              </p>
            </div>
          </div>
        ) : (
          <section className="border-t border-[#eeeee7]">
            {highlights.map(
              (highlight) => {
                const title =
                  getBookTitle(
                    highlight.book_id
                  );

                const isDeleting =
                  deletingId ===
                  highlight.id;

                return (
                  <div
                    key={
                      highlight.id
                    }
                    className="group border-b border-[#eeeee7] py-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* =================================================
                          하이라이트 본문
                      ================================================== */}

                        <Link
                        href={`/drive?fileId=${encodeURIComponent(
                            highlight.drive_file_id
                        )}&episode=${highlight.episode}&highlightId=${encodeURIComponent(
                            highlight.id
                        )}`}
                        className="min-w-0 flex-1"
                        >
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-medium text-[#b08d5f]">
                            {title}
                          </p>

                          <span className="shrink-0 text-xs text-[#b0b0a4]">
                            {highlight.episode}
                            화
                          </span>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap break-words font-serif text-[15px] leading-8 text-[#45453f]">
                          {highlight.text}
                        </p>

                        <p className="mt-3 text-[11px] text-[#b0b0a4]">
                          {formatDate(
                            highlight.created_at
                          )}
                        </p>
                      </Link>

                      {/* =================================================
                          삭제
                      ================================================== */}

                      <button
                        onClick={() =>
                          deleteHighlight(
                            highlight.id
                          )
                        }
                        disabled={
                          isDeleting ||
                          deletingId !==
                            null
                        }
                        aria-label="하이라이트 삭제"
                        className="shrink-0 rounded-lg p-2 text-[#c0c0b7] opacity-100 transition hover:bg-black/5 hover:text-[#8a8a80] disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </section>
        )}
      </div>
    </main>
  );
}