"use client";

import Link from "next/link";
import BookCover from "../components/BookCover";
import SubPageLayout from "../components/SubPageLayout";
import { useEffect, useState } from "react";
import { Bookmark, Check, Loader2, Trash2, X } from "lucide-react";

type BookmarkItem = {
  id: string;
  book_id: string;
  drive_file_id: string;
  episode: number;
  created_at: string;
};

type Book = {
  id: string;
  title: string;
  drive_file_id: string;
};

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedBookmarks, setSelectedBookmarks] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  async function loadBookmarks() {
    setLoading(true);
    setError("");

    try {
      const [bookmarkResponse, booksResponse] = await Promise.all([
        fetch("/api/bookmarks"),
        fetch("/api/books?fields=titles"),
      ]);

      const bookmarkData = await bookmarkResponse.json();

      const booksData = await booksResponse.json();

      if (!bookmarkResponse.ok) {
        throw new Error(bookmarkData?.error || "북마크를 불러오지 못했습니다.");
      }

      if (!booksResponse.ok) {
        throw new Error(booksData?.error || "책 정보를 불러오지 못했습니다.");
      }

      setBookmarks(bookmarkData.data || []);
      setBooks(booksData.data || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "북마크를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookmarks();
  }, []);

  function getBookTitle(bookId: string) {
    const book = books.find((item) => item.id === bookId);

    return book?.title || "알 수 없는 소설";
  }

  function toggleBookmarkSelection(bookmarkId: string) {
    setSelectedBookmarks((current) =>
      current.includes(bookmarkId)
        ? current.filter((id) => id !== bookmarkId)
        : [...current, bookmarkId],
    );
  }

  function enterSelectMode() {
    setSelectMode(true);
    setSelectedBookmarks([]);
  }

  function exitSelectMode() {
    if (deleting) return;

    setSelectMode(false);
    setSelectedBookmarks([]);
  }

  async function deleteBookmark(bookmark: BookmarkItem) {
    const response = await fetch(
      `/api/bookmarks?driveFileId=${encodeURIComponent(
        bookmark.drive_file_id,
      )}&episode=${bookmark.episode}`,
      {
        method: "DELETE",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "북마크를 삭제하지 못했습니다.");
    }
  }

  async function deleteSelectedBookmarks() {
    if (selectedBookmarks.length === 0 || deleting) {
      return;
    }

    setDeleting(true);

    try {
      const targets = bookmarks.filter((bookmark) =>
        selectedBookmarks.includes(bookmark.id),
      );

      for (const bookmark of targets) {
        await deleteBookmark(bookmark);
      }

      setBookmarks((current) =>
        current.filter((bookmark) => !selectedBookmarks.includes(bookmark.id)),
      );

      setSelectedBookmarks([]);
      setSelectMode(false);
    } catch (error) {
      console.error("북마크 일괄 삭제 실패:", error);

      alert(
        error instanceof Error
          ? error.message
          : "북마크를 삭제하지 못했습니다.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SubPageLayout
      title="북마크"
      count={!loading && !error ? bookmarks.length : undefined}
      headerRight={
        !loading && !error && bookmarks.length > 0 ? (
          selectMode ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={exitSelectMode}
                disabled={deleting}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-500 transition hover:bg-stone-200/60 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                취소
              </button>

              <button
                type="button"
                onClick={deleteSelectedBookmarks}
                disabled={selectedBookmarks.length === 0 || deleting}
                className="flex items-center gap-1 rounded-full bg-[#8a3a3a] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#702e2e] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {selectedBookmarks.length > 0
                  ? `선택 삭제 (${selectedBookmarks.length})`
                  : "선택 삭제"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={enterSelectMode}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-500 ring-1 ring-stone-300 transition hover:bg-stone-100 hover:text-stone-900"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          )
        ) : null
      }
    >
      {loading ? (
        <div className="mt-6 flex items-center justify-center rounded-2xl bg-stone-200/50 py-16 text-sm text-stone-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          북마크를 불러오는 중...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center text-sm text-red-600">
          {error}
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center">
          <Bookmark className="mx-auto h-7 w-7 text-stone-300" />
          <p className="mt-4 text-sm text-stone-400">
            저장한 북마크가 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-stone-200/70 rounded-2xl border border-stone-200/70 bg-white/60">
          {bookmarks.map((bookmark) => {
            const selected = selectedBookmarks.includes(bookmark.id);
            const title = getBookTitle(bookmark.book_id);

            return (
              <div
                key={bookmark.id}
                className="flex items-center gap-3.5 px-4 py-3.5"
              >
                {selectMode && (
                  <button
                    type="button"
                    onClick={() => toggleBookmarkSelection(bookmark.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                      selected
                        ? "border-[#8a3a3a] bg-[#8a3a3a] text-white"
                        : "border-stone-300 bg-white"
                    }`}
                    aria-label={selected ? "선택 해제" : "북마크 선택"}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </button>
                )}

                <BookCover
                  compact
                  title={title}
                  className="h-16 w-11"
                  textClass="text-[8px]"
                />

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-semibold">
                    {title}
                  </h2>

                  <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                    <Bookmark
                      className="h-3 w-3 text-[#8a3a3a]"
                      fill="currentColor"
                    />
                    {bookmark.episode}화
                    <span className="text-stone-300">·</span>
                    {new Date(bookmark.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>

                {!selectMode && (
                  <Link
                    href={`/drive?fileId=${encodeURIComponent(
                      bookmark.drive_file_id,
                    )}&episode=${bookmark.episode}`}
                    className="shrink-0 rounded-full bg-[#8a3a3a] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#702e2e]"
                  >
                    읽기
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SubPageLayout>
  );
}
