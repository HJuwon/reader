"use client";

import {
  Fragment,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";

type Props<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** 한 번에 보여 줄 개수 (아래로 내리면 이만큼씩 더 보인다) */
  pageSize?: number;
};

/**
 * 북마크·하이라이트·읽기 기록처럼 끝없이 길어지는 목록용.
 * - 목록 안에서 따로 스크롤된다 (페이지 전체가 한없이 길어지지 않는다).
 * - 처음에는 pageSize개만 그리고, 아래로 내리면 더 불러온다.
 */
export default function PagedScrollList<T>({
  items,
  getKey,
  renderItem,
  pageSize = 40,
}: Props<T>) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const shown = items.slice(0, visibleCount);
  const remaining = items.length - shown.length;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;

    if (
      remaining > 0 &&
      el.scrollTop + el.clientHeight >= el.scrollHeight - 240
    ) {
      setVisibleCount((count) => count + pageSize);
    }
  };

  return (
    <div
      onScroll={handleScroll}
      className="mt-6 max-h-[calc(100dvh-16rem)] min-h-[12rem] divide-y divide-line/70 overflow-y-auto overscroll-contain rounded-2xl border border-line/70 bg-white/60"
    >
      {shown.map((item) => (
        <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
      ))}

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + pageSize)}
          className="w-full py-3.5 text-xs font-medium text-slate-400 transition hover:text-slate-600"
        >
          더 보기 ({remaining.toLocaleString("ko-KR")}개 남음)
        </button>
      )}
    </div>
  );
}
