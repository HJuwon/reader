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

    episodes.push({
      episode: candidate.number ?? index + 1,
      title: candidate.title || `제${candidate.number ?? index + 1}화`,
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