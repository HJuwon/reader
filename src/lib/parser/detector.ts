import { EpisodeCandidate } from "./types";
import type { EpisodeRule } from "./types";

type Pattern = {
  name: string;
  regex: RegExp;
  getNumber?: (match: RegExpMatchArray) => number | undefined;
  getTitle?: (match: RegExpMatchArray) => string;
};

const patterns: Pattern[] = [
  // === Episode 1 ===
  // === Episode1 ===
  // === Ep 1 ===
  // === Ep1 ===
  {
    name: "wrapped_english_episode",
    regex:
      /^\s*={2,}\s*(?:episode|ep\.?)\s*(\d{1,5})(?:\s*[-.:·]\s*(.*?))?\s*={2,}\s*$/i,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  // === Chapter 1 ===
  // === Chapter1 ===
  {
    name: "wrapped_english_chapter",
    regex:
      /^\s*={2,}\s*(?:chapter|ch\.?)\s*(\d{1,5})(?:\s*[-.:·]\s*(.*?))?\s*={2,}\s*$/i,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "korean_episode",
    regex:
      /^\s*(?:제\s*)?(\d{1,5})\s*화(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "korean_chapter",
    regex:
      /^\s*(?:제\s*)?(\d{1,5})\s*장(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "english_chapter",
    regex:
      /^\s*(?:chapter|ch\.?)\s*[-.]?\s*(\d{1,5})(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/i,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "english_episode",
    regex:
      /^\s*(?:episode|ep\.?)\s*[-.]?\s*(\d{1,5})(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/i,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "part",
    regex:
      /^\s*(?:part|pt\.?)\s*[-.]?\s*(\d{1,5})(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/i,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "bracket_episode",
    regex:
      /^\s*[\[【]\s*(?:제\s*)?(\d{1,5})\s*화\s*[\]】]\s*(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "parenthesis_episode",
    regex:
      /^\s*[\(（]\s*(?:제\s*)?(\d{1,5})\s*화\s*[\)）]\s*(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "decorated_episode",
    regex:
      /^\s*[-=*#~─━_]+\s*(?:제\s*)?(\d{1,5})\s*(?:화|장)\s*[-=*#~─━_]*\s*(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "chinese_episode",
    regex:
      /^\s*第\s*(\d{1,5})\s*話\s*(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "chinese_chapter",
    regex:
      /^\s*第\s*(\d{1,5})\s*章\s*(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },
];

/**
 * 정규식에 사용할 문자열의 특수문자를 escape한다.
 */
function escapeRegExp(value: string): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/**
 * 사용자가 설정한 공통 회차 규칙을 정규식으로 변환한다.
 *
 * 예:
 *   외전 제xxx화
 *
 * →
 *   외전 제1화
 *   외전 제2화
 *   외전 제100화
 *
 * xxx는 반드시 숫자로 치환되는 부분이다.
 */
function buildCustomRulePattern(
  rule: string
): RegExp | null {
  const marker = "xxx";

  const markerIndex = rule.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  // xxx가 두 개 이상 들어간 규칙은
  // 현재 구조에서는 지원하지 않는다.
  if (
    rule.indexOf(
      marker,
      markerIndex + marker.length
    ) !== -1
  ) {
    return null;
  }

  const prefix = rule
    .slice(0, markerIndex)
    .trim();

  const suffix = rule
    .slice(markerIndex + marker.length)
    .trim();

  if (!prefix && !suffix) {
    return null;
  }

  const prefixPattern =
    escapeRegExp(prefix);

  const suffixPattern =
    escapeRegExp(suffix);

  // suffix(예: "화", ".") 뒤에는 구분자(-, ., :, · 등)가 있을 수도 있고
  // 없이 공백만 두고 바로 제목이 이어질 수도 있다.
  // (예: "#001. 첫 번째 화 제목" → suffix "." 를 이미 소비했으므로
  //  그 뒤에는 별도 구분자 없이 공백 + 제목만 온다.)
  // 따라서 구분자 자체를 옵셔널로 두고, 제목 캡처 그룹은 항상 존재하게 한다.
  return new RegExp(
    `^\\s*${prefixPattern}\\s*(\\d{1,6})\\s*${suffixPattern}\\s*(?:[-.:·]\\s*)?(.*?)\\s*$`,
    "i"
  );
}

export function detectCandidates(
  lines: string[],
  customRules: EpisodeRule[] = []
): EpisodeCandidate[] {
  const candidates: EpisodeCandidate[] = [];

  /**
   * 사용자가 설정한 공통 회차 규칙을
   * 실제 정규식으로 변환한다.
   */
  const customPatterns = customRules
    .map((rule) => ({
      rule: rule.rule,
      regex: buildCustomRulePattern(
        rule.rule
      ),
    }))
    .filter(
      (
        item
      ): item is {
        rule: string;
        regex: RegExp;
      } => item.regex !== null
    );

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    /**
     * =====================================================
     * 1. 사용자 공통 회차 규칙 먼저 검사
     * =====================================================
     *
     * 예:
     *   규칙: 외전 제xxx화
     *
     *   외전 제1화
     *   외전 제2화
     *   외전 제10화
     *
     * 모두 여기서 잡힌다.
     */
    for (const customPattern of customPatterns) {
      const match = trimmed.match(
        customPattern.regex
      );

      if (!match) {
        continue;
      }

      const number = Number(match[1]);

      const title =
        match[2]?.trim() || "";

      candidates.push({
        lineIndex,
        number,
        title,
        raw: line,
        pattern: `custom:${customPattern.rule}`,
        score: 0,
      });

      // 사용자 규칙에 매칭됐으면
      // 기본 패턴은 다시 검사하지 않는다.
      return;
    }

    /**
     * =====================================================
     * 2. 기존 기본 회차 규칙 검사
     * =====================================================
     */
    for (const pattern of patterns) {
      const match = trimmed.match(
        pattern.regex
      );

      if (!match) {
        continue;
      }

      const number =
        pattern.getNumber?.(match);

      const title =
        pattern.getTitle?.(match) || "";

      candidates.push({
        lineIndex,
        number,
        title,
        raw: line,
        pattern: pattern.name,
        score: 0,
      });

      break;
    }
  });

  return candidates;
}
