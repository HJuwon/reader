"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
} from "lucide-react";

type Round = {
  id: string;
  round: number;
  status: "reading" | "completed";
  started_at: string;
  completed_at: string | null;
  episode?: number;
  progress?: number;
};

type Book = {
  id: string;
  drive_file_id: string;
  title: string;
  total_episodes: number;
  last_episode: number;
  progress: number;
  status: string;
  updated_at: string;
  rounds?: Round[];
};

type HistoryEntry = {
  book: Book;
  round: Round;
};

const statusLabel: Record<string, string> = {
  reading: "읽는 중",
  completed: "완독",
};

const statusStyle: Record<string, string> = {
  reading: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
};

export default function HistoryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/books");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "읽기 이력을 불러오지 못했습니다."
          );
        }

        setBooks(data.data || []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "읽기 이력을 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  // 책 × 회독 조합을 하나의 읽기 기록 항목으로 펼친다.
  const historyEntries = useMemo<HistoryEntry[]>(() => {
    const entries: HistoryEntry[] = [];

    for (const book of books) {
      const rounds = book.rounds ?? [];

      for (const round of rounds) {
        // 아직 시작만 하고 진행이 없는 회독은 이력에서 제외
        if (
          (round.episode ?? 0) === 0 &&
          (round.progress ?? 0) === 0 &&
          round.status !== "completed"
        ) {
          continue;
        }

        entries.push({ book, round });
      }
    }

    return entries.sort((a, b) => {
      const dateA = new Date(
        a.round.completed_at ??
          a.round.started_at
      ).getTime();

      const dateB = new Date(
        b.round.completed_at ??
          b.round.started_at
      ).getTime();

      return dateB - dateA;
    });
  }, [books]);

  function formatDate(dateString: string) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getReaderUrl(entry: HistoryEntry) {
    const episode =
      entry.round.episode && entry.round.episode > 0
        ? entry.round.episode
        : entry.book.last_episode;

    return `/drive?fileId=${encodeURIComponent(
      entry.book.drive_file_id
    )}&episode=${episode}`;
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
            <BookOpen className="h-4 w-4" />
            <h1 className="text-xl font-semibold">
              읽기 이력
            </h1>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            회독별 읽기 기록을 모아볼 수 있습니다.
          </p>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center justify-center rounded-2xl border bg-white py-16 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            읽기 이력을 불러오는 중...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border bg-white px-6 py-16 text-center text-sm text-red-500">
            {error}
          </div>
        ) : historyEntries.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-white px-6 py-16 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-gray-300" />

            <p className="mt-4 text-sm text-gray-400">
              아직 읽기 이력이 없습니다.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border bg-white">
            {historyEntries.map((entry, index) => (
              <Link
                key={entry.round.id}
                href={getReaderUrl(entry)}
                className={`flex items-center gap-3 p-4 transition hover:bg-gray-50 ${
                  index !== historyEntries.length - 1
                    ? "border-b"
                    : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <BookOpen className="h-3.5 w-3.5 text-gray-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-medium">
                      {entry.book.title}
                    </h2>

                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusStyle[entry.round.status]}`}
                    >
                      {statusLabel[entry.round.status]}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">
                      {entry.round.round}회독
                    </span>

                    <span className="text-xs text-gray-300">
                      ·
                    </span>

                    <span className="text-xs text-gray-400">
                      {entry.round.episode ?? 0}화 ·{" "}
                      {entry.round.progress ?? 0}%
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-gray-400">
                    {formatDate(
                      entry.round.completed_at ??
                        entry.round.started_at
                    )}
                  </p>
                </div>

                <div className="hidden w-24 shrink-0 sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, entry.round.progress ?? 0)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

