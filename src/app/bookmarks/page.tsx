"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

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
  const [selectedBookmarks, setSelectedBookmarks] =
    useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  async function loadBookmarks() {
    setLoading(true);
    setError("");

    try {
      const [bookmarkResponse, booksResponse] =
        await Promise.all([
          fetch("/api/bookmarks"),
          fetch("/api/books"),
        ]);

      const bookmarkData =
        await bookmarkResponse.json();

      const booksData =
        await booksResponse.json();

      if (!bookmarkResponse.ok) {
        throw new Error(
          bookmarkData?.error ||
            "북마크를 불러오지 못했습니다."
        );
      }

      if (!booksResponse.ok) {
        throw new Error(
          booksData?.error ||
            "책 정보를 불러오지 못했습니다."
        );
      }

      setBookmarks(bookmarkData.data || []);
      setBooks(booksData.data || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "북마크를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookmarks();
  }, []);

  function getBookTitle(bookId: string) {
    const book = books.find(
      (item) => item.id === bookId
    );

    return book?.title || "알 수 없는 소설";
  }

  function toggleBookmarkSelection(
    bookmarkId: string
  ) {
    setSelectedBookmarks((current) =>
      current.includes(bookmarkId)
        ? current.filter(
            (id) => id !== bookmarkId
          )
        : [...current, bookmarkId]
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

  async function deleteBookmark(
    bookmark: BookmarkItem
  ) {
    const response = await fetch(
      `/api/bookmarks?driveFileId=${encodeURIComponent(
        bookmark.drive_file_id
      )}&episode=${bookmark.episode}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "북마크를 삭제하지 못했습니다."
      );
    }
  }

  async function deleteSelectedBookmarks() {
    if (
      selectedBookmarks.length === 0 ||
      deleting
    ) {
      return;
    }

    setDeleting(true);

    try {
      const targets = bookmarks.filter((bookmark) =>
        selectedBookmarks.includes(bookmark.id)
      );

      for (const bookmark of targets) {
        await deleteBookmark(bookmark);
      }

      setBookmarks((current) =>
        current.filter(
          (bookmark) =>
            !selectedBookmarks.includes(
              bookmark.id
            )
        )
      );

      setSelectedBookmarks([]);
      setSelectMode(false);
    } catch (error) {
      console.error(
        "북마크 일괄 삭제 실패:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "북마크를 삭제하지 못했습니다."
      );
    } finally {
      setDeleting(false);
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

          {!loading &&
            !error &&
            bookmarks.length > 0 &&
            (selectMode ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelectMode}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  취소
                </button>

                <button
                  type="button"
                  onClick={deleteSelectedBookmarks}
                  disabled={
                    selectedBookmarks.length === 0 ||
                    deleting
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
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
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            ))}
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10 pb-24">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            <h1 className="text-xl font-semibold">
              북마크
            </h1>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            저장한 회차를 모아볼 수 있습니다.
          </p>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center justify-center rounded-2xl border bg-white py-16 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            북마크를 불러오는 중...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border bg-white px-6 py-16 text-center text-sm text-red-500">
            {error}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-white px-6 py-16 text-center">
            <Bookmark className="mx-auto h-7 w-7 text-gray-300" />

            <p className="mt-4 text-sm text-gray-400">
              저장한 북마크가 없습니다.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border bg-white">
            <div className="max-h-[60vh] overflow-y-auto">
            {bookmarks.map(
              (bookmark, index) => {
                const selected =
                  selectedBookmarks.includes(
                    bookmark.id
                  );

                return (
                  <div
                    key={bookmark.id}
                    className={`flex items-center gap-3 p-4 ${
                      index !==
                      bookmarks.length - 1
                        ? "border-b"
                        : ""
                    }`}
                  >
                    {selectMode && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleBookmarkSelection(
                            bookmark.id
                          )
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-300 bg-white"
                        }`}
                        aria-label={
                          selected
                            ? "선택 해제"
                            : "북마크 선택"
                        }
                      >
                        {selected && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Bookmark
                        className="h-3.5 w-3.5 text-gray-500"
                        fill="currentColor"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-medium">
                        {getBookTitle(
                          bookmark.book_id
                        )}
                      </h2>

                      <p className="mt-1 text-xs text-gray-400">
                        {bookmark.episode}화
                      </p>
                    </div>

                    {!selectMode && (
                      <Link
                        href={`/drive?fileId=${encodeURIComponent(
                          bookmark.drive_file_id
                        )}&episode=${bookmark.episode}`}
                        className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
                      >
                        읽기
                      </Link>
                    )}
                  </div>
                );
              }
            )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
