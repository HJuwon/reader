"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
} from "lucide-react";

type Book = {
  id: string;
  drive_file_id: string;
  title: string;
  total_episodes: number;
  last_episode: number;
  progress: number;
  status: string;
  updated_at: string;
};

export default function HistoryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/books");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "읽기 이력을 불러오지 못했습니다."
          );
        }

        const history = (data.data || [])
          .filter(
            (book: Book) =>
              book.progress > 0
          )
          .sort(
            (a: Book, b: Book) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime()
          );

        setBooks(history);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "읽기 이력을 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(date);
  };

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#1e1e1c]">
      <div className="mx-auto w-full max-w-2xl px-5 pb-10">
        {/* 헤더 */}
        <header className="flex h-16 items-center border-b border-[#eeeee7]">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft
              className="h-5 w-5"
              strokeWidth={1.75}
            />
            <span>서재</span>
          </Link>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-medium">
            읽기 이력
          </h1>
        </header>

        {/* 내용 */}
        <section className="pt-6">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-500">
              {error}
            </div>
          ) : books.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <BookOpen
                className="mb-4 h-8 w-8 text-gray-300"
                strokeWidth={1.5}
              />

              <p className="text-sm text-gray-400">
                아직 읽기 이력이 없습니다.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eeeee7]">
              {books.map((book) => (
                <Link
                  key={book.id}
                  href={`/drive?fileId=${encodeURIComponent(
                    book.drive_file_id
                  )}&episode=${book.last_episode}`}
                  className="block py-5 transition-opacity hover:opacity-70"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-serif text-[17px] leading-snug">
                        {book.title}
                      </h2>

                      <p className="mt-2 text-sm text-gray-500">
                        {book.last_episode > 0
                          ? `최근 ${book.last_episode}화`
                          : "읽기 시작"}
                        {" · "}
                        {book.progress}%
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(book.updated_at)}
                      </p>
                    </div>

                    <div className="pt-1 text-xs text-gray-400">
                      {book.status}
                    </div>
                  </div>

                  {/* 진행률 */}
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#b08d5f]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            book.progress
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}