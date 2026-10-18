import { Episode, EpisodeCandidate } from "./types";

export function buildEpisodes(
  lines: string[],
  candidates: EpisodeCandidate[]
): {
  episodes: Episode[];
  preface: string;
} {
  if (candidates.length === 0) {
    return {
      episodes: [],
      preface: lines.join("\n").trim(),
    };
  }

  const episodes: Episode[] = [];

  const firstEpisodeLine = candidates[0].lineIndex;

  const preface = lines.slice(0, firstEpisodeLine).join("\n").trim();

  // 일반 회차는 본문에 적힌 번호를 따르고,
  // 커스텀 규칙(2부 1화 등)은 바로 앞 회차 번호에서 1씩 이어 간다.
  // (파싱에서 한 화가 빠져도 334화 다음은 항상 335화가 된다)
  let runningNumber = 0;

  candidates.forEach((candidate, index) => {
    const startLine = candidate.lineIndex;

    const endLine =
      index < candidates.length - 1
        ? candidates[index + 1].lineIndex - 1
        : lines.length - 1;

    const content = lines
      .slice(startLine + 1, endLine + 1)
      .join("\n")
      .trim();

    // 커스텀 규칙(예: "2부 xxx화")으로 잡힌 회차는
    // 왼쪽에는 전체 누적 번호(335화), 오른쪽에는 원래 이름(2부 1화)을 보여준다.
    const hasCustomLabel = Boolean(candidate.label);

    runningNumber = hasCustomLabel
      ? runningNumber + 1
      : (candidate.number ?? runningNumber + 1);

    episodes.push({
      episode: candidate.number ?? index + 1,
      title: hasCustomLabel
        ? candidate.title
          ? `${candidate.label} ${candidate.title}`
          : candidate.label!
        : candidate.title || `제${candidate.number ?? index + 1}화`,
      label: hasCustomLabel ? `${runningNumber}화` : undefined,
      content,
      startLine,
      endLine,
    });
  });

  return {
    episodes,
    preface,
  };
}
