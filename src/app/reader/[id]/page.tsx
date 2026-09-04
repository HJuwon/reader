"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  List,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ParsedChapter } from "@/lib/novelParser";
import { getNovel } from "@/lib/novelStorage";

export default function ReaderPage() {
  const searchParams = useSearchParams();

  const chapterParam = Number(searchParams.get("chapter"));

  const [chapters, setChapters] = useState<ParsedChapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [readingMode, setReadingMode] = useState<"scroll" | "page">("scroll");
  const [showChapters, setShowChapters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNovel = async () => {
      try {
        const novel = await getNovel("1");

        if (!novel) {
          setLoading(false);
          return;
        }

        setChapters(novel.chapters);

        const initialChapter =
          chapterParam >= 1 && chapterParam <= novel.chapters.length
            ? chapterParam
            : 1;

        setCurrentChapter(initialChapter);
      } catch (error) {
        console.error("소설을 불러오는 중 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNovel();
  }, [chapterParam]);

  const currentChapterData = chapters[currentChapter - 1];

  const moveToChapter = (chapter: number) => {
    if (chapter < 1 || chapter > chapters.length) return;

    setCurrentChapter(chapter);

    const url = `/reader/1?chapter=${chapter}`;
    window.history.pushState({}, "", url);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrevious = () => {
    if (currentChapter > 1) {
      moveToChapter(currentChapter - 1);
    }
  };

  const goNext = () => {
    if (currentChapter < chapters.length) {
      moveToChapter(currentChapter + 1);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
        <p className="text-sm text-gray-400">
          소설을 불러오는 중...
        </p>
      </main>
    );
  }

  if (!currentChapterData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">
            불러온 소설이 없습니다.
          </p>

          <p className="mt-2 text-xs text-gray-400">
            먼저 TXT 파일을 업로드해주세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf9f7] text-gray-900">
      <header className="sticky top-0 z-20 bg-[#faf9f7]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <button
            onClick={() => window.history.back()}
            className="rounded-full p-2 text-gray-500 hover:bg-black/5"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <p className="text-sm text-gray-400">
            {currentChapterData.title}
          </p>

          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`rounded-full p-2 ${
              bookmarked
                ? "text-blue-600"
                : "text-gray-400 hover:bg-black/5"
            }`}
            aria-label="북마크"
          >
            <Bookmark
              className="h-5 w-5"
              fill={bookmarked ? "currentColor" : "none"}
            />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-10 pt-6">
        <div className="mb-8 text-center">
          <p className="text-xs text-gray-400">
            {currentChapterData.number !== null
              ? `${currentChapterData.number}화`
              : currentChapterData.type}
          </p>

          <h1 className="mt-2 font-serif text-2xl font-semibold">
            {currentChapterData.title}
          </h1>
        </div>

        <article
          className="mx-auto max-w-2xl font-serif"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.9,
          }}
        >
          {currentChapterData.content
            .split(/\n+/)
            .filter((paragraph) => paragraph.trim())
            .map((paragraph, index) => (
              <p key={index} className="mb-7 whitespace-pre-wrap">
                {paragraph.trim()}
              </p>
            ))}
        </article>

        <div className="mt-14 flex items-center justify-between">
          <button
            onClick={goPrevious}
            disabled={currentChapter === 1}
            className="flex items-center gap-1 rounded-full px-4 py-2.5 text-sm text-gray-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            이전 화
          </button>

          <span className="text-xs text-gray-300">
            {currentChapter} / {chapters.length}
          </span>

          <button
            onClick={goNext}
            disabled={currentChapter === chapters.length}
            className="flex items-center gap-1 rounded-full px-4 py-2.5 text-sm text-gray-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            다음 화
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="sticky bottom-0 z-20 border-t border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-around px-4 py-3">
          <button
            onClick={() => setShowChapters(true)}
            className="flex flex-col items-center gap-1 text-xs text-gray-500"
          >
            <List className="h-5 w-5" />
            <span>목차</span>
          </button>

          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`flex flex-col items-center gap-1 text-xs ${
              bookmarked ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <Bookmark
              className="h-5 w-5"
              fill={bookmarked ? "currentColor" : "none"}
            />
            <span>북마크</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center gap-1 text-xs text-gray-500"
          >
            <Settings className="h-5 w-5" />
            <span>설정</span>
          </button>
        </div>
      </nav>

      {showChapters && (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute bottom-0 left-0 right-0 max-h-[75vh] rounded-t-3xl bg-white">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h2 className="font-medium">목차</h2>

              <button
                onClick={() => setShowChapters(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                닫기
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-2 pb-4">
              {chapters.map((chapter, index) => (
                <button
                  key={chapter.id}
                  onClick={() => {
                    moveToChapter(index + 1);
                    setShowChapters(false);
                  }}
                  className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${
                    index + 1 === currentChapter
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {chapter.number !== null
                    ? `${chapter.number}화`
                    : chapter.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">읽기 설정</h2>

              <button
                onClick={() => setShowSettings(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                닫기
              </button>
            </div>

            <div className="mt-6">
              <p className="text-sm text-gray-500">읽기 방식</p>

              <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1">
                <button
                  onClick={() => setReadingMode("scroll")}
                  className={`rounded-xl py-2.5 text-sm transition ${
                    readingMode === "scroll"
                      ? "bg-white font-medium text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  스크롤
                </button>

                <button
                  onClick={() => setReadingMode("page")}
                  className={`rounded-xl py-2.5 text-sm transition ${
                    readingMode === "page"
                      ? "bg-white font-medium text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  페이지
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">글자 크기</p>
                <span className="text-sm text-gray-400">
                  {fontSize}px
                </span>
              </div>

              <input
                type="range"
                min="14"
                max="24"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="mt-4 w-full"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}