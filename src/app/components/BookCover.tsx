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

// 표지 이미지가 없을 때 쓰는 책 모양 표지 (책등 + 제목)
// 나중에 표지 이미지가 생기면 이 컴포넌트만 바꾸면 됨
export default function BookCover({
  title,
  seriesStatus,
  className = "",
  textClass = "text-[11px]",
  compact = false,
}: {
  title: string;
  seriesStatus?: SeriesStatus;
  className?: string;
  textClass?: string;
  compact?: boolean;
}) {
  const name = getSearchTitle(title);

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
