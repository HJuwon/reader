"use client";

import Link from "next/link";
import BookCover from "../components/BookCover";
import SubPageLayout from "../components/SubPageLayout";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";

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
  series_status?: "ongoing" | "completed";
  cover_url?: string | null;
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

export default function HistoryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/books?include=rounds");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "읽기 이력을 불러오지 못했습니다.");
        }

        setBooks(data.data || []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "읽기 이력을 불러오지 못했습니다.",
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
        a.round.completed_at ?? a.round.started_at,
      ).getTime();

      const dateB = new Date(
        b.round.completed_at ?? b.round.started_at,
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
      entry.book.drive_file_id,
    )}&episode=${episode}`;
  }

  return (
    <SubPageLayout
      title="읽기 이력"
      count={!loading && !error ? historyEntries.length : undefined}
    >
      {loading ? (
        <div className="mt-6 flex items-center justify-center rounded-2xl bg-card py-16 text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          읽기 이력을 불러오는 중...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center text-sm text-red-600">
          {error}
        </div>
      ) : historyEntries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-4 text-sm text-slate-400">
            아직 읽기 이력이 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-line/70 rounded-2xl border border-line/70 bg-white/60">
          {historyEntries.map((entry) => {
            const progress = Math.min(
              100,
              Math.max(0, entry.round.progress ?? 0),
            );
            const completed = entry.round.status === "completed";

            return (
              <Link
                key={entry.round.id}
                href={getReaderUrl(entry)}
                className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-card"
              >
                <BookCover
                  compact
                  title={entry.book.title}
                  seriesStatus={entry.book.series_status}
                  coverUrl={entry.book.cover_url}
                  className="h-[72px] w-12"
                  textClass="text-[8px]"
                />

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold">
                    {entry.book.title}
                  </h2>

                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        completed ? "bg-done" : "bg-accent"
                      }`}
                    />
                    {statusLabel[entry.round.status]}
                    <span className="text-slate-300">·</span>
                    {entry.round.round}회독
                    <span className="text-slate-300">·</span>
                    {entry.round.episode ?? 0}화
                  </p>

                  <div className="mt-2 flex items-center gap-2.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${
                          completed ? "bg-done" : "bg-accent"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-500">
                      {progress}%
                    </span>
                  </div>

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {formatDate(
                      entry.round.completed_at ?? entry.round.started_at,
                    )}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            );
          })}
        </div>
      )}
    </SubPageLayout>
  );
}
