"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Highlighter,
  Loader2,
  Trash2,
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

type Book = {
  id: string;
  title: string;
  drive_file_id: string;
};

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadHighlights() {
    setLoading(true);
    setError("");

    try {
      const [highlightsResponse, booksResponse] =
        await Promise.all([
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

      setHighlights(highlightsData.data || []);
      setBooks(booksData.data || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "하이라이트를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHighlights();
  }, []);

  function getBookTitle(bookId: string) {
    const book = books.find((item) => item.id === bookId);

    return book?.title || "알 수 없는 소설";
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  async function deleteHighlight(id: string) {
    if (deletingId) return;

    setDeletingId(id);

    try {
      const response = await fetch(
        `/api/highlights?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "하이라이트를 삭제하지 못했습니다."
        );
      }

      setHighlights((current) =>
        current.filter(
          (highlight) => highlight.id !== id
        )
      );
    } catch (error) {
      console.error("하이라이트 삭제 실패:", error);

      alert(
        error instanceof Error
          ? error.message
          : "하이라이트를 삭제하지 못했습니다."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            서재
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10 pb-24">
        <div>
          <div className="flex items-center gap-2">
            <Highlighter className="h-4 w-4" />
            <h1 className="text-xl font-semibold">
              하이라이트
            </h1>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            저장한 문장을 모아볼 수 있습니다.
          </p>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center justify-center rounded-2xl border bg-white py-16 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            하이라이트를 불러오는 중...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border bg-white px-6 py-16 text-center text-sm text-red-500">
            {error}
          </div>
        ) : highlights.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-white px-6 py-16 text-center">
            <Highlighter className="mx-auto h-7 w-7 text-gray-300" />

            <p className="mt-4 text-sm text-gray-400">
              저장한 하이라이트가 없습니다.
            </p>

            <p className="mt-2 text-xs leading-6 text-gray-400">
              소설을 읽다가 문장을 드래그하면
              <br />
              하이라이트로 저장할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border bg-white">
            <div className="max-h-[60vh] overflow-y-auto">
            {highlights.map((highlight, index) => {
              const isDeleting =
                deletingId === highlight.id;

              return (
                <div
                  key={highlight.id}
                  className={`group flex items-start gap-3 p-4 ${
                    index !== highlights.length - 1
                      ? "border-b"
                      : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Highlighter className="h-3.5 w-3.5 text-gray-500" />
                  </div>

                  <Link
                    href={`/drive?fileId=${encodeURIComponent(
                      highlight.drive_file_id
                    )}&episode=${highlight.episode}&highlightId=${encodeURIComponent(
                      highlight.id
                    )}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-medium">
                        {getBookTitle(highlight.book_id)}
                      </h2>

                      <span className="shrink-0 text-xs text-gray-400">
                        {highlight.episode}화
                      </span>
                    </div>

                    <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-sm text-gray-600">
                      {highlight.text}
                    </p>

                    <p className="mt-1.5 text-xs text-gray-400">
                      {formatDate(highlight.created_at)}
                    </p>
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      deleteHighlight(highlight.id)
                    }
                    disabled={
                      isDeleting || deletingId !== null
                    }
                    aria-label="하이라이트 삭제"
                    className="shrink-0 rounded-lg p-2 text-gray-300 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
