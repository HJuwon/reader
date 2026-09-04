import { EpisodeCandidate } from "./types";

export function scoreCandidates(
  candidates: EpisodeCandidate[],
  lines: string[]
): EpisodeCandidate[] {
  return candidates.map((candidate, index) => {
    let score = 0;

    const line = lines[candidate.lineIndex].trim();

    if (candidate.number !== undefined) {
      score += 30;
    }

    if (candidate.title) {
      score += 10;
    }

    if (line.length <= 100) {
      score += 10;
    }

    if (candidate.lineIndex === 0) {
      score += 5;
    }

    const previous = candidates[index - 1];
    const next = candidates[index + 1];

    if (
      previous?.number !== undefined &&
      candidate.number !== undefined &&
      candidate.number === previous.number + 1
    ) {
      score += 30;
    }

    if (
      next?.number !== undefined &&
      candidate.number !== undefined &&
      next.number === candidate.number + 1
    ) {
      score += 30;
    }

    if (candidate.pattern === "numeric_title") {
      score -= 10;
    }

    return {
      ...candidate,
      score,
    };
  });
}

export function selectCandidates(
  candidates: EpisodeCandidate[],
  minimumScore = 40
): EpisodeCandidate[] {
  return candidates.filter((candidate) => candidate.score >= minimumScore);
}