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

    episodes.push({
      episode: candidate.number ?? index + 1,
      title: hasCustomLabel
        ? candidate.title
          ? `${candidate.label} ${candidate.title}`
          : candidate.label!
        : candidate.title || `제${candidate.number ?? index + 1}화`,
      label: hasCustomLabel ? `${index + 1}화` : undefined,
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
