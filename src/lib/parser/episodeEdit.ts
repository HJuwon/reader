import { getLines } from "./normalize";

/**
 * 한 회차만 고치는 편집.
 * 책 전체(수 MB)를 서버로 보내지 않고, 고친 회차만 보내서
 * 서버가 드라이브의 원본에 같은 방식으로 끼워 넣는다.
 * (브라우저·서버가 같은 함수를 써서 결과가 항상 같다)
 */
export type EpisodeEdit = {
  /** 회차 제목 줄의 위치(0부터) */
  startLine: number;
  /** 회차 마지막 줄의 위치 */
  endLine: number;
  /** 새 제목 줄(한 줄) */
  titleLine: string;
  /** 새 본문 */
  text: string;
  /** 고치기 전의 회차 전체(제목 줄 포함). 파일이 그 사이 바뀌었는지 확인용 */
  expectedOld: string;
};

/** 회차 한 개(제목 줄 ~ 마지막 줄)를 원문 그대로 잘라 낸다. */
export function sliceEpisodeText(
  content: string,
  startLine: number,
  endLine: number
): string {
  return getLines(content)
    .slice(startLine, endLine + 1)
    .join("\n");
}

/** 서버가 받은 원본이 편집 시작 때의 내용과 같은지 확인한다. */
export function matchesOriginal(
  content: string,
  edit: Pick<EpisodeEdit, "startLine" | "endLine" | "expectedOld">
): boolean {
  return (
    sliceEpisodeText(content, edit.startLine, edit.endLine) ===
    edit.expectedOld
  );
}

/** 편집을 적용한 새 전체 본문을 돌려준다. */
export function applyEpisodeEdit(
  content: string,
  edit: Pick<
    EpisodeEdit,
    "startLine" | "endLine" | "titleLine" | "text"
  >
): string {
  const lines = getLines(content);

  return [
    ...lines.slice(0, edit.startLine),
    edit.titleLine,
    ...edit.text.split("\n"),
    ...lines.slice(edit.endLine + 1),
  ].join("\n");
}
