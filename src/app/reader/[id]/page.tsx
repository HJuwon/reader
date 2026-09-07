"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  List,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Search,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import type { ParsedChapter } from "@/lib/novelParser";
import { getNovel } from "@/lib/novelStorage";

// ---------------------------------------------------------------------------
// Reading themes — each theme owns bg / text / muted / surface / border,
// applied via inline style so the palette can change without touching layout.
// ---------------------------------------------------------------------------
const THEMES = {
  light: {
    label: "라이트",
    swatch: "#f6f1e7",
    bg: "#faf7f2",
    fg: "#221f1b",
    muted: "#948c7e",
    surface: "#ffffff",
    border: "rgba(30,25,15,0.08)",
    accent: "#2f6fed",
  },
  sepia: {
    label: "세피아",
    swatch: "#e8d8ae",
    bg: "#f1e4c3",
    fg: "#3c2f1c",
    muted: "#8c7a54",
    surface: "#f8eed6",
    border: "rgba(60,47,28,0.14)",
    accent: "#a6631b",
  },
  dark: {
    label: "다크",
    swatch: "#3a3733",
    bg: "#1d1c19",
    fg: "#e8e3d9",
    muted: "#8f897c",
    surface: "#28261f",
    border: "rgba(255,255,255,0.09)",
    accent: "#6ea8ff",
  },
  black: {
    label: "블랙",
    swatch: "#0a0a0a",
    bg: "#000000",
    fg: "#c8c4bb",
    muted: "#615d55",
    surface: "#0c0c0c",
    border: "rgba(255,255,255,0.06)",
    accent: "#7a9dff",
  },
} as const;

type ThemeKey = keyof typeof THEMES;

const FONTS = {
  serif: { label: "명조", sample: "가", family: '"Noto Serif KR", Georgia, serif' },
  sans: { label: "고딕", sample: "가", family: '"Pretendard", "Noto Sans KR", system-ui, sans-serif' },
} as const;

type FontKey = keyof typeof FONTS;

export default function ReaderPage() {
  const searchParams = useSearchParams();
  const chapterParam = Number(searchParams.get("chapter"));

  const [chapters, setChapters] = useState<ParsedChapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [loading, setLoading] = useState(true);

  // reading prefs
  const [readingMode, setReadingMode] = useState<"scroll" | "page">("scroll");
  const [theme, setTheme] = useState<ThemeKey>("light");
  const [font, setFont] = useState<FontKey>("serif");
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.9);

  // ui state
  const [bookmarked, setBookmarked] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tocQuery, setTocQuery] = useState("");
  const [progress, setProgress] = useState(0);

  const articleRef = useRef<HTMLDivElement>(null);
  const activeTocRef = useRef<HTMLButtonElement>(null);

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
  const nextChapterData = chapters[currentChapter];
  const t = THEMES[theme];
  const f = FONTS[font];

  const moveToChapter = (chapter: number) => {
    if (chapter < 1 || chapter > chapters.length) return;
    setCurrentChapter(chapter);
    setChromeVisible(true);
    const url = `/reader/1?chapter=${chapter}`;
    window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrevious = () => currentChapter > 1 && moveToChapter(currentChapter - 1);
  const goNext = () => currentChapter < chapters.length && moveToChapter(currentChapter + 1);

  // scroll-based progress + chrome auto behavior
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0;
      setProgress(pct);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [currentChapter]);

  // keyboard shortcuts for desktop testing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrevious();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (showToc) {
      requestAnimationFrame(() => {
        activeTocRef.current?.scrollIntoView({ block: "center" });
      });
    }
  }, [showToc]);

  const filteredChapters = useMemo(() => {
    if (!tocQuery.trim()) return chapters;
    const q = tocQuery.trim().toLowerCase();
    return chapters.filter((c) => c.title.toLowerCase().includes(q));
  }, [chapters, tocQuery]);

  const handleContentTap = (e: React.MouseEvent) => {
    // ignore taps that originate on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input")) return;
    setChromeVisible((v) => !v);
  };

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: THEMES.light.bg }}
      >
        <p className="text-sm" style={{ color: THEMES.light.muted }}>
          소설을 불러오는 중...
        </p>
      </main>
    );
  }

  if (!currentChapterData) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: THEMES.light.bg }}
      >
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: THEMES.light.fg }}>
            불러온 소설이 없습니다.
          </p>
          <p className="mt-2 text-xs" style={{ color: THEMES.light.muted }}>
            먼저 TXT 파일을 업로드해주세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen transition-colors duration-300"
      style={{ background: t.bg, color: t.fg }}
    >
      {/* progress bar */}
      <div
        className="fixed left-0 top-0 z-30 h-[3px] w-full"
        style={{ background: t.border }}
      >
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progress * 100}%`, background: t.accent }}
        />
      </div>

      {/* header — floats away when chrome hidden */}
      <header
        className={`fixed left-0 right-0 top-0 z-20 transition-transform duration-300 ${
          chromeVisible ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{
          background: `${t.bg}f2`,
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 pt-[3px]">
          <button
            onClick={() => window.history.back()}
            className="rounded-full p-2 transition hover:opacity-70"
            style={{ color: t.muted }}
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[11px] tracking-wide" style={{ color: t.muted }}>
              {currentChapter} / {chapters.length}화
            </span>
            <span className="max-w-[50vw] truncate text-xs font-medium" style={{ color: t.fg }}>
              {currentChapterData.title}
            </span>
          </div>

          <button
            onClick={() => setBookmarked(!bookmarked)}
            className="rounded-full p-2 transition hover:opacity-70"
            style={{ color: bookmarked ? t.accent : t.muted }}
            aria-label="북마크"
          >
            <Bookmark className="h-5 w-5" fill={bookmarked ? "currentColor" : "none"} />
          </button>
        </div>
      </header>

      {/* edge tap zones for chapter navigation */}
      <button
        onClick={goPrevious}
        disabled={currentChapter === 1}
        aria-label="이전 화"
        className="fixed left-0 top-14 z-10 h-[calc(100vh-3.5rem-5rem)] w-11 disabled:cursor-default"
      />
      <button
        onClick={goNext}
        disabled={currentChapter === chapters.length}
        aria-label="다음 화"
        className="fixed right-0 top-14 z-10 h-[calc(100vh-3.5rem-5rem)] w-11 disabled:cursor-default"
      />

      {/* content */}
      <div
        onClick={handleContentTap}
        className="mx-auto max-w-2xl px-6 pb-32 pt-20"
      >
        <div className="mb-10">
          <p className="text-xs tracking-wide" style={{ color: t.accent }}>
            {currentChapterData.number !== null
              ? `제 ${currentChapterData.number}화`
              : currentChapterData.type}
          </p>
          <h1
            className="mt-2 text-[1.7rem] font-semibold leading-snug"
            style={{ fontFamily: f.family }}
          >
            {currentChapterData.title}
          </h1>
          <div className="mt-5 h-px w-10" style={{ background: t.accent }} />
        </div>

        <article
          ref={articleRef}
          style={{
            fontFamily: f.family,
            fontSize: `${fontSize}px`,
            lineHeight,
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

        {/* next-chapter CTA card, replaces the old plain prev/next buttons */}
        <button
          onClick={goNext}
          disabled={currentChapter === chapters.length}
          className="mt-6 flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left transition disabled:cursor-default"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: t.muted }}>
              {currentChapter === chapters.length ? "마지막 화입니다" : "다음 화"}
            </p>
            <p className="mt-1 truncate text-sm font-medium" style={{ color: t.fg }}>
              {nextChapterData ? nextChapterData.title : "완결까지 모두 읽었어요"}
            </p>
          </div>
          {nextChapterData && (
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: t.muted }} />
          )}
        </button>
      </div>

      {/* floating bottom control capsule */}
      <div
        className={`fixed inset-x-0 bottom-0 z-20 flex justify-center pb-5 transition-all duration-300 ${
          chromeVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="flex items-center gap-1 rounded-full px-2 py-2 shadow-lg"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}
        >
          <button
            onClick={() => setShowToc(true)}
            className="rounded-full p-2.5 transition hover:opacity-70"
            style={{ color: t.muted }}
            aria-label="목차"
          >
            <List className="h-[18px] w-[18px]" />
          </button>

          <button
            onClick={goPrevious}
            disabled={currentChapter === 1}
            className="rounded-full p-2.5 transition hover:opacity-70 disabled:opacity-25"
            style={{ color: t.fg }}
            aria-label="이전 화"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>

          <span
            className="min-w-[3.2rem] text-center text-xs font-medium tabular-nums"
            style={{ color: t.muted }}
          >
            {currentChapter} / {chapters.length}
          </span>

          <button
            onClick={goNext}
            disabled={currentChapter === chapters.length}
            className="rounded-full p-2.5 transition hover:opacity-70 disabled:opacity-25"
            style={{ color: t.fg }}
            aria-label="다음 화"
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>

          <div className="mx-1 h-5 w-px" style={{ background: t.border }} />

          <button
            onClick={() => setBookmarked(!bookmarked)}
            className="rounded-full p-2.5 transition hover:opacity-70"
            style={{ color: bookmarked ? t.accent : t.muted }}
            aria-label="북마크"
          >
            <Bookmark className="h-[18px] w-[18px]" fill={bookmarked ? "currentColor" : "none"} />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="rounded-full p-2.5 transition hover:opacity-70"
            style={{ color: t.muted }}
            aria-label="설정"
          >
            <Settings2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* TOC — right-side slide-in drawer */}
      {showToc && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowToc(false)}
          />
          <div
            className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col"
            style={{ background: t.surface }}
          >
            <div className="px-5 pb-3 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: t.fg }}>
                    목차
                  </h2>
                  <p className="mt-0.5 text-xs" style={{ color: t.muted }}>
                    총 {chapters.length}화
                  </p>
                </div>
                <button
                  onClick={() => setShowToc(false)}
                  className="text-sm"
                  style={{ color: t.muted }}
                >
                  닫기
                </button>
              </div>

              <div
                className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: t.bg, border: `1px solid ${t.border}` }}
              >
                <Search className="h-4 w-4" style={{ color: t.muted }} />
                <input
                  value={tocQuery}
                  onChange={(e) => setTocQuery(e.target.value)}
                  placeholder="화 제목 검색"
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: t.fg }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-6">
              {filteredChapters.map((chapter) => {
                const chapterIndex = chapters.indexOf(chapter);
                const isActive = chapterIndex + 1 === currentChapter;
                return (
                  <button
                    key={chapter.id}
                    ref={isActive ? activeTocRef : undefined}
                    onClick={() => {
                      moveToChapter(chapterIndex + 1);
                      setShowToc(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition"
                    style={{
                      background: isActive ? `${t.accent}14` : "transparent",
                      borderLeft: `2px solid ${isActive ? t.accent : "transparent"}`,
                      color: isActive ? t.accent : t.fg,
                    }}
                  >
                    <span className="flex-1 truncate">
                      {chapter.number !== null ? `${chapter.number}화 · ${chapter.title}` : chapter.title}
                    </span>
                    {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.accent }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* settings — redesigned bottom sheet */}
      {showSettings && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSettings(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl px-6 pb-8 pt-5"
            style={{ background: t.surface }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full" style={{ background: t.border }} />

            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: t.fg }}>
                읽기 설정
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-sm" style={{ color: t.muted }}>
                닫기
              </button>
            </div>

            {/* live preview */}
            <p
              className="mt-5 rounded-2xl p-4 text-center"
              style={{
                background: t.bg,
                border: `1px solid ${t.border}`,
                fontFamily: f.family,
                fontSize: `${fontSize}px`,
                lineHeight,
                color: t.fg,
              }}
            >
              가나다라 abc 미리보기
            </p>

            {/* theme swatches */}
            <div className="mt-6">
              <p className="text-xs" style={{ color: t.muted }}>테마</p>
              <div className="mt-3 flex gap-3">
                {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        background: THEMES[key].swatch,
                        border: `2px solid ${theme === key ? t.accent : "transparent"}`,
                        boxShadow: `0 0 0 1px ${t.border}`,
                      }}
                    >
                      {theme === key && (
                        <Check className="h-4 w-4" style={{ color: THEMES[key].fg }} />
                      )}
                    </span>
                    <span className="text-[11px]" style={{ color: theme === key ? t.fg : t.muted }}>
                      {THEMES[key].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* font family */}
            <div className="mt-6">
              <p className="text-xs" style={{ color: t.muted }}>글꼴</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(Object.keys(FONTS) as FontKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFont(key)}
                    className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm transition"
                    style={{
                      background: font === key ? `${t.accent}14` : t.bg,
                      border: `1px solid ${font === key ? t.accent : t.border}`,
                      color: font === key ? t.accent : t.fg,
                      fontFamily: FONTS[key].family,
                    }}
                  >
                    <span className="text-base">{FONTS[key].sample}</span>
                    {FONTS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* font size stepper */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: t.muted }}>글자 크기</p>
                <span className="text-xs tabular-nums" style={{ color: t.fg }}>{fontSize}px</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <StepButton
                  icon={<Minus className="h-4 w-4" />}
                  onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                  theme={t}
                />
                <div className="h-1.5 flex-1 rounded-full" style={{ background: t.border }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${((fontSize - 14) / (26 - 14)) * 100}%`,
                      background: t.accent,
                    }}
                  />
                </div>
                <StepButton
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setFontSize((s) => Math.min(26, s + 1))}
                  theme={t}
                />
              </div>
            </div>

            {/* line height stepper */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: t.muted }}>줄 간격</p>
                <span className="text-xs tabular-nums" style={{ color: t.fg }}>{lineHeight.toFixed(1)}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <StepButton
                  icon={<Minus className="h-4 w-4" />}
                  onClick={() => setLineHeight((v) => Math.max(1.4, Math.round((v - 0.1) * 10) / 10))}
                  theme={t}
                />
                <div className="h-1.5 flex-1 rounded-full" style={{ background: t.border }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${((lineHeight - 1.4) / (2.4 - 1.4)) * 100}%`,
                      background: t.accent,
                    }}
                  />
                </div>
                <StepButton
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setLineHeight((v) => Math.min(2.4, Math.round((v + 0.1) * 10) / 10))}
                  theme={t}
                />
              </div>
            </div>

            {/* reading mode */}
            <div className="mt-6">
              <p className="text-xs" style={{ color: t.muted }}>읽기 방식</p>
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
                {(["scroll", "page"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setReadingMode(mode)}
                    className="rounded-xl py-2.5 text-sm transition"
                    style={{
                      background: readingMode === mode ? t.surface : "transparent",
                      color: readingMode === mode ? t.fg : t.muted,
                      fontWeight: readingMode === mode ? 500 : 400,
                      boxShadow: readingMode === mode ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {mode === "scroll" ? "스크롤" : "페이지"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StepButton({
  icon,
  onClick,
  theme,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  theme: (typeof THEMES)[ThemeKey];
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:opacity-70"
      style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.fg }}
    >
      {icon}
    </button>
  );
}