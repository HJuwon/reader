import { EpisodeCandidate } from "./types";

/**
 * 규칙에서 xxx 앞에 아무 글자도 없는지(= 숫자로 바로 시작하는 규칙인지) 확인한다.
 *
 * 예:
 *   "xxx."      → true   (본문의 "5.", "3.14" 같은 줄과 구분되는 특징이 없다)
 *   "외전 제xxx화" → false  ("외전 제"가 있어서 그 자체로 구분된다)
 */
function isPrefixlessRule(pattern: string): boolean {
  // 앞의 ^ 는 "줄 맨 앞" 표시일 뿐이라 글자로 치지 않는다.
  const rule = pattern
    .slice("custom:".length)
    .trim()
    .replace(/^\^/, "");
  const markerIndex = rule.indexOf("xxx");

  return (
    markerIndex !== -1 &&
    rule.slice(0, markerIndex).trim() === ""
  );
}

export function scoreCandidates(
  candidates: EpisodeCandidate[],
  lines: string[]
): EpisodeCandidate[] {
  // 규칙별로 "제목이 있는 후보"의 번호를 모아 둔다.
  // (제목 없는 숫자 줄이 진짜 회차인지 판단하는 기준)
  const titledNumbers = new Map<string, Set<number>>();

  candidates.forEach((candidate) => {
    if (!candidate.title || candidate.number === undefined) {
      return;
    }

    const numbers =
      titledNumbers.get(candidate.pattern) ?? new Set<number>();

    numbers.add(candidate.number);
    titledNumbers.set(candidate.pattern, numbers);
  });

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

    const followsPrevious =
      previous?.number !== undefined &&
      candidate.number !== undefined &&
      candidate.number ===
        previous.number + 1;

    const precedesNext =
      next?.number !== undefined &&
      candidate.number !== undefined &&
      next.number === candidate.number + 1;

    if (followsPrevious) {
      score += 30;
    }

    if (precedesNext) {
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
      /**
       * "xxx."처럼 숫자로 바로 시작하는 규칙은
       * 본문 속 숫자 줄(예: 카운트다운 "5." "4." "3." "2." "1.")도
       * 똑같이 잡아 버린다.
       *
       * 같은 규칙에 제목 있는 회차가 2개 이상이면 "이 작품의 회차에는
       * 제목이 있다"고 보고, 제목 없는 숫자 줄은 아래 경우에 회차로 보지 않는다.
       *   - 앞뒤 후보와 번호가 이어지지 않는다 (5, 4, 3 … 처럼 거꾸로 가는 경우 등)
       *   - 같은 번호의 제목 있는 회차가 이미 있다 (카운트다운의 "1." 등)
       *
       * 제목 없이 "1." "2." "3." 으로만 이어지는 작품은 판단할 근거가 없으므로
       * 기존처럼 모두 회차로 인정한다.
       */
      const titledCount =
        titledNumbers.get(candidate.pattern)?.size ?? 0;

      const isSuspiciousBareNumber =
        isPrefixlessRule(candidate.pattern) &&
        !candidate.title &&
        titledCount >= 2;

      if (
        isSuspiciousBareNumber &&
        ((!followsPrevious && !precedesNext) ||
          (candidate.number !== undefined &&
            titledNumbers
              .get(candidate.pattern)
              ?.has(candidate.number)))
      ) {
        return {
          ...candidate,
          score: -1,
        };
      }

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
