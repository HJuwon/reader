import { EpisodeCandidate } from "./types";

export function scoreCandidates(
  candidates: EpisodeCandidate[],
  lines: string[]
): EpisodeCandidate[] {
  return candidates.map((candidate, index) => {
    let score = 0;

    const line =
      lines[candidate.lineIndex].trim();

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

    const previous =
      candidates[index - 1];

    const next =
      candidates[index + 1];

    if (
      previous?.number !== undefined &&
      candidate.number !== undefined &&
      candidate.number ===
        previous.number + 1
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

    if (
      candidate.pattern ===
      "numeric_title"
    ) {
      score -= 10;
    }

    /**
     * 사용자가 직접 추가한 공통 회차 규칙은
     * 명시적으로 회차 형식으로 지정한 것이므로
     * 충분한 점수를 보장한다.
     *
     * 예:
     *   custom:외전 제xxx화
     *
     * → 외전 제1화
     * → 외전 제2화
     */
    if (
      candidate.pattern.startsWith(
        "custom:"
      )
    ) {
      score += 20;
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
  return candidates.filter(
    (candidate) =>
      candidate.score >= minimumScore
  );
}
