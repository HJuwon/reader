"use client";

import Link from "next/link";
import BookCover from "../components/BookCover";
import SubPageLayout from "../components/SubPageLayout";
import { useEffect, useState } from "react";
import { Highlighter, Loader2, Trash2 } from "lucide-react";

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
  series_status?: "ongoing" | "completed";
  cover_url?: string | null;
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
      const [highlightsResponse, booksResponse] = await Promise.all([
        fetch("/api/highlights"),
        fetch("/api/books?fields=titles"),
      ]);

      const highlightsData = await highlightsResponse.json();

      const booksData = await booksResponse.json();

      if (!highlightsResponse.ok) {
        throw new Error(
          highlightsData?.error || "하이라이트를 불러오지 못했습니다.",
        );
      }

      if (!booksResponse.ok) {
        throw new Error(booksData?.error || "책 정보를 불러오지 못했습니다.");
      }

      setHighlights(highlightsData.data || []);
      setBooks(booksData.data || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "하이라이트를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHighlights();
  }, []);

  function getBookSeriesStatus(bookId: string) {
    return books.find((item) => item.id === bookId)?.series_status;
  }

  function getBookCover(bookId: string) {
    return books.find((item) => item.id === bookId)?.cover_url;
  }

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
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "하이라이트를 삭제하지 못했습니다.");
      }

      setHighlights((current) =>
        current.filter((highlight) => highlight.id !== id),
      );
    } catch (error) {
      console.error("하이라이트 삭제 실패:", error);

      alert(
        error instanceof Error
          ? error.message
          : "하이라이트를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <SubPageLayout
      title="하이라이트"
      count={!loading && !error ? highlights.length : undefined}
    >
      {loading ? (
        <div className="mt-6 flex items-center justify-center rounded-2xl bg-card py-16 text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          하이라이트를 불러오는 중...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center text-sm text-red-600">
          {error}
        </div>
      ) : highlights.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <Highlighter className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-4 text-sm text-slate-400">
            저장한 하이라이트가 없습니다.
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            소설을 읽다가 문장을 드래그하면
            <br />
            하이라이트로 저장할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-line/70 rounded-2xl border border-line/70 bg-white/60">
          {highlights.map((highlight) => {
            const isDeleting = deletingId === highlight.id;
            const title = getBookTitle(highlight.book_id);

            return (
              <div
                key={highlight.id}
                className="flex items-start gap-3.5 px-4 py-4"
              >
                <BookCover
                  compact
                  title={title}
                  seriesStatus={getBookSeriesStatus(highlight.book_id)}
                  coverUrl={getBookCover(highlight.book_id)}
                  className="h-16 w-11"
                  textClass="text-[8px]"
                />

                <Link
                  href={`/drive?fileId=${encodeURIComponent(
                    highlight.drive_file_id,
                  )}&episode=${highlight.episode}&highlightId=${encodeURIComponent(
                    highlight.id,
                  )}`}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{title}</h2>
                    <span className="shrink-0 text-xs text-slate-400">
                      {highlight.episode}화
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words border-l-2 border-accent bg-[#f3e4c4]/40 py-1 pl-3 pr-2 font-serif text-sm leading-6 text-slate-700">
                    {highlight.text}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {formatDate(highlight.created_at)}
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={() => deleteHighlight(highlight.id)}
                  disabled={isDeleting || deletingId !== null}
                  aria-label="하이라이트 삭제"
                  className="shrink-0 rounded-full p-2 text-slate-300 transition hover:bg-slate-200/60 hover:text-slate-600 disabled:opacity-40"
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
      )}
    </SubPageLayout>
  );
}
