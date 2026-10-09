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

// 차분한 책 표지 톤 (갈색·버건디·스톤 계열만 사용)
const COVER_COLORS: [string, string][] = [
  ["#7b5e4b", "#5a4234"],
  ["#8a4a47", "#643330"],
  ["#6e6257", "#4f463d"],
  ["#9a7556", "#74553c"],
  ["#5e4a42", "#43342e"],
  ["#7a6a55", "#584b3b"],
];

// 표지 이미지가 없을 때 쓰는 책 모양 표지 (책등 + 제목)
// 나중에 표지 이미지가 생기면 이 컴포넌트만 바꾸면 됨
export default function BookCover({
  title,
  className = "",
  textClass = "text-[11px]",
  compact = false,
}: {
  title: string;
  className?: string;
  textClass?: string;
  compact?: boolean;
}) {
  const name = getSearchTitle(title);

  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.codePointAt(0)!) % 1000003;
  }

  const [from, to] = COVER_COLORS[hash % COVER_COLORS.length];

  return (
    <div
      aria-hidden
      className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-l-sm rounded-r-md text-center font-serif font-semibold leading-snug text-white/95 shadow-[0_6px_14px_-4px_rgba(60,40,20,0.35)] ${
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
