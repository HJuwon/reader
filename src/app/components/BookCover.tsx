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
//  - 완결   : 진한 네이비/인디고 계열
//  - 연재중 : 밝은 스카이/시안 계열
//  - 알 수 없음 : 중간 톤 슬레이트 블루
const COVER_COLORS = {
  completed: [
    ["#1e3a8a", "#172554"],
    ["#1e40af", "#1e3a8a"],
    ["#312e81", "#1e1b4b"],
  ],
  ongoing: [
    ["#0ea5e9", "#0369a1"],
    ["#38a3d8", "#0b6aa2"],
    ["#06b6d4", "#0e7490"],
  ],
  unknown: [
    ["#64748b", "#475569"],
    ["#5b7fa6", "#3f5f86"],
  ],
} satisfies Record<string, [string, string][]>;

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

  const palette =
    seriesStatus === "completed"
      ? COVER_COLORS.completed
      : seriesStatus === "ongoing"
        ? COVER_COLORS.ongoing
        : COVER_COLORS.unknown;

  const [from, to] = palette[hash % palette.length];

  return (
    <div
      aria-hidden
      className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-l-sm rounded-r-md text-center font-serif font-semibold leading-snug text-white/95 shadow-[0_6px_14px_-4px_rgba(3,105,161,0.35)] ${
        compact ? "pl-2.5 pr-1" : "px-2.5 pl-3.5"
      } ${className}`}
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-black/20" />
      <span className="absolute inset-y-0 left-1.5 w-px bg-white/20" />
      <span className={`line-clamp-4 break-keep ${textClass}`}>{name}</span>
      <span className="mt-1.5 h-px w-5 bg-white/40" />
    </div>
  );
}
