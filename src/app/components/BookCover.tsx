"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// 제목에서 [완결], 1-300화, 확장자 등을 걷어낸 "작품명"만 추출
export function getSearchTitle(title: string): string {
  return (
    title
      .replace(/\.(txt|epub|docx?)$/i, "")
      .replace(/[\[(（【][^\])）】]*[\])）】]/g, " ")
      .replace(/\d+\s*[-~]\s*\d+\s*화?/g, " ")
      .replace(/\s+/g, " ")
      .trim() || title
  );
}

// 표지 색 규칙 (표지 이미지가 없을 때)
//  - 완결   : 페리윙클 계열
//  - 연재중 : 스카이블루 계열
// 실제 색 값은 globals.css 의 --cover-* 변수에서 바꾼다.
const v = (kind: string, n: number): [string, string] => [
  `var(--cover-${kind}-${n}-from)`,
  `var(--cover-${kind}-${n}-to)`,
];

const COVER_COLORS = {
  completed: {
    text: "var(--cover-completed-text)",
    colors: [v("completed", 1), v("completed", 2), v("completed", 3)],
  },
  ongoing: {
    text: "var(--cover-ongoing-text)",
    colors: [v("ongoing", 1), v("ongoing", 2), v("ongoing", 3)],
  },
  unknown: {
    text: "var(--cover-unknown-text)",
    colors: [v("unknown", 1), v("unknown", 2)],
  },
} satisfies Record<string, { text: string; colors: [string, string][] }>;

export type SeriesStatus = "ongoing" | "completed" | null | undefined;

// 표지를 눌렀을 때 뜨는 확대 창
// 바깥 영역이나 X 버튼, (안드로이드) 뒤로가기, Esc 로 닫힌다.
function CoverModal({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("close-cover-modal", onClose);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("close-cover-modal", onClose);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // 이 창은 카드(링크) 안에서 만들어지므로, 클릭이 카드로 올라가
  // 소설이 열리지 않도록 모든 클릭의 전파를 막는다.
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return createPortal(
    <div
      data-cover-modal
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        stop(event);
        onClose();
      }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/70 p-6"
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={(event) => {
          stop(event);
          onClose();
        }}
        className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        onClick={stop}
        className="max-h-[70vh] max-w-[85vw] rounded-md object-contain shadow-2xl"
      />

      <p className="max-w-[85vw] text-center text-sm font-semibold text-white">
        {title}
      </p>
    </div>,
    document.body
  );
}

// 표지 이미지가 없을 때 쓰는 책 모양 표지 (책등 + 제목)
// 나중에 표지 이미지가 생기면 이 컴포넌트만 바꾸면 됨
export default function BookCover({
  title,
  seriesStatus,
  coverUrl,
  zoomable = false,
  className = "",
  textClass = "text-[11px]",
  compact = false,
}: {
  title: string;
  seriesStatus?: SeriesStatus;
  coverUrl?: string | null;
  zoomable?: boolean;
  className?: string;
  textClass?: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const name = getSearchTitle(title);

  if (coverUrl && !failed) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          onClick={
            zoomable
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(true);
                }
              : undefined
          }
          className={`shrink-0 rounded-l-sm rounded-r-md object-cover shadow-[0_6px_14px_-4px_rgb(0_0_0/0.18)] ${
            zoomable ? "cursor-zoom-in" : ""
          } ${className}`}
        />
        {open && <CoverModal src={coverUrl} title={name} onClose={close} />}
      </>
    );
  }

  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.codePointAt(0)!) % 1000003;
  }

  const theme =
    seriesStatus === "completed"
      ? COVER_COLORS.completed
      : seriesStatus === "ongoing"
        ? COVER_COLORS.ongoing
        : COVER_COLORS.unknown;

  const [from, to] = theme.colors[hash % theme.colors.length];

  return (
    <div
      aria-hidden
      className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-l-sm rounded-r-md text-center font-serif font-semibold leading-snug shadow-[0_6px_14px_-4px_rgb(0_0_0/0.18)] ${
        compact ? "pl-2.5 pr-1" : "px-2.5 pl-3.5"
      } ${className}`}
      style={{
        background: `linear-gradient(160deg, ${from}, ${to})`,
        color: theme.text,
      }}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-black/10" />
      <span className="absolute inset-y-0 left-1.5 w-px bg-white/50" />
      <span className={`line-clamp-4 break-keep ${textClass}`}>{name}</span>
      <span className="mt-1.5 h-px w-5 bg-current opacity-30" />
    </div>
  );
}
