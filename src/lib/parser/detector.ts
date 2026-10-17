import { EpisodeCandidate } from "./types";
import type { RuleOption } from "./rules";

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

  // 소설제목 1화
  // 아무 글자 1화 - 부제
  // (앞에 붙는 글자는 소설마다 달라서 무엇이든 허용한다. 짧은 줄만 대상)
  {
    name: "titled_episode",
    regex:
      /^(?=.{1,80}$)\s*(\S.*?)\s+(\d{1,5})\s*화(?=$|\s|[-.:·])(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/,
    getNumber: (m) => Number(m[2]),
    getTitle: (m) => m[3]?.trim() || "",
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
 * 여는 괄호 → 닫는 괄호
 */
const BRACKET_PAIRS: Record<string, string> = {
  "<": ">",
  "[": "]",
  "(": ")",
  "{": "}",
  "〈": "〉",
  "《": "》",
  "「": "」",
  "『": "』",
  "【": "】",
  "（": "）",
  "［": "］",
};

/**
 * 규칙에서 xxx 바로 앞이 여는 괄호이면, 짝이 되는 닫는 괄호를 돌려준다.
 *
 * 예:
 *   "<xxx"      → { open: "<", close: ">" }
 *   "[xxx"      → { open: "[", close: "]" }
 *   "외전 제xxx화" → null
 */
function getClosingBracket(
  rule: string
): { open: string; close: string } | null {
  const markerIndex = rule.indexOf("xxx");

  if (markerIndex === -1) {
    return null;
  }

  const prefix = rule.slice(0, markerIndex).trim();

  // xxx 바로 앞 글자가 여는 괄호이거나(예: "[xxx"),
  // 규칙 맨 앞이 여는 괄호인 경우(예: "< [외전] xxx화")를 찾는다.
  for (const open of [prefix.slice(-1), prefix.slice(0, 1)]) {
    const close = BRACKET_PAIRS[open];

    if (close) {
      return { open, close };
    }
  }

  return null;
}

/**
 * 사용자 규칙에서 목록에 보여줄 이름을 만든다.
 *
 * 예: "< [외전] xxx화" → 1 → "외전 1화"
 *     "외전 제xxx화"   → 1 → "외전 1화"
 *     "xxx화" 처럼 앞에 붙은 말이 없으면 undefined (기본 "N화")
 */
function buildCustomLabel(
  rule: string,
  number: number
): string | undefined {
  const markerIndex = rule.indexOf("xxx");

  if (markerIndex === -1) {
    return undefined;
  }

  const word = rule
    .slice(0, markerIndex)
    .replace(/\*/g, " ")
    .replace(/[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*제$/, "")
    .trim();

  const suffix = rule
    .slice(markerIndex + "xxx".length)
    .trim();

  const unit = /^[A-Za-z가-힣]+$/.test(suffix)
    ? suffix
    : "";

  if (!word) {
    return unit ? `${number}${unit}` : undefined;
  }

  return `${word} ${number}${unit}`;
}

/**
 * 제목 끝에 남은 닫는 괄호를 제거한다.
 *
 * 예: "첫만남>"  → "첫만남"
 *     ">"       → ""            (제목 없이 "<1>"만 있는 경우)
 *     "A <B>"   → "A <B>"       (괄호가 짝이 맞으면 제목의 일부이므로 유지)
 */
function stripClosingBracket(
  title: string,
  bracket: { open: string; close: string } | null
): string {
  if (!bracket || !title.endsWith(bracket.close)) {
    return title;
  }

  const countOf = (char: string) =>
    title.split(char).length - 1;

  // 닫는 괄호가 여는 괄호보다 많을 때만(= 짝이 없는 닫는 괄호일 때만) 제거한다.
  if (countOf(bracket.close) <= countOf(bracket.open)) {
    return title;
  }

  return title
    .slice(0, -bracket.close.length)
    .trim();
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
/**
 * 규칙 앞뒤의 ^ 와 $ 를 분리한다.
 *
 *   "* xxx화$"  → 줄이 "화"로 끝나야 한다 (뒤에 글자가 더 있으면 제외)
 *   "^xxx화"    → 줄 맨 앞에서 시작 (원래도 줄 맨 앞부터 보므로 같은 뜻)
 *
 * 본문 속 "1화에서 있었던 일…" 같은 문장이 잡히는 것을 막을 때 쓴다.
 */
export function splitRuleAnchors(rule: string): {
  core: string;
  endAnchored: boolean;
} {
  const trimmed = rule.trim();

  return {
    core: trimmed
      .replace(/^\^/, "")
      .replace(/\$$/, "")
      .trim(),
    endAnchored: trimmed.endsWith("$"),
  };
}

function buildCustomRulePattern(
  rule: string,
  endAnchored = false
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

  // 규칙 앞부분의 * 는 "아무 글자"를 뜻한다. (예: "* xxx화")
  // 소설마다 다른 제목을 규칙마다 따로 쓰지 않아도 되게 하기 위함이다.
  // 본문 문장이 잡히지 않도록 짧은 줄만 대상으로 한다.
  const hasWildcard = prefix.includes("*");

  const prefixPattern =
    (hasWildcard ? "(?=.{1,80}$)" : "") +
    prefix
      .split("*")
      .map(escapeRegExp)
      .join(".+?");

  const suffixPattern =
    escapeRegExp(suffix);

  // suffix가 "."으로 끝나는 규칙(예: "xxx.")은 소수점이 있는 숫자
  // (예: "3.14159", "12.5kg")도 "3화 + 제목 14159"처럼 잡아 버린다.
  // 회차 번호의 점 바로 뒤에 숫자가 붙어 있으면 소수점으로 보고 제외한다.
  // (점 뒤에 공백을 두고 숫자로 시작하는 제목, 예: "3. 14일 후"는 그대로 허용)
  // 와일드카드(*) 규칙은 "3화에서 만난…" 같은 본문 문장이 잡히지 않도록
  // suffix 바로 뒤가 줄 끝, 공백, 구분자 중 하나일 때만 허용한다.
  const boundaryPattern = hasWildcard
    ? "(?=$|\\s|[-.:·])"
    : "";

  const notDecimalPattern =
    suffix.endsWith(".")
      ? "(?!\\d)"
      : "";

  // suffix(예: "화", ".") 뒤에는 구분자(-, ., :, · 등)가 있을 수도 있고
  // 없이 공백만 두고 바로 제목이 이어질 수도 있다.
  // (예: "#001. 첫 번째 화 제목" → suffix "." 를 이미 소비했으므로
  //  그 뒤에는 별도 구분자 없이 공백 + 제목만 온다.)
  // 따라서 구분자 자체를 옵셔널로 두고, 제목 캡처 그룹은 항상 존재하게 한다.
  // 끝을 $ 로 고정한 규칙: 회차 표시(예: "화") 바로 뒤에서 줄이 끝나야 한다.
  // 제목 칸은 비어 있는 그룹으로 둔다.
  if (endAnchored) {
    return new RegExp(
      `^\\s*${prefixPattern}\\s*(\\d{1,6})\\s*${suffixPattern}${notDecimalPattern}()\\s*$`,
      "i"
    );
  }

  return new RegExp(
    `^\\s*${prefixPattern}\\s*(\\d{1,6})\\s*${suffixPattern}${boundaryPattern}${notDecimalPattern}\\s*(?:[-.:·]\\s*)?(.*?)\\s*$`,
    "i"
  );
}

export function detectCandidates(
  lines: string[],
  option: RuleOption
): EpisodeCandidate[] {
  const candidates: EpisodeCandidate[] = [];

  /**
   * 선택된 규칙 하나만 사용한다.
   *
   * - custom : 사용자가 추가한 규칙(예: "외전 제xxx화")을 정규식으로 변환
   * - builtin: 해당 형식에 속한 기본 패턴들만 사용
   */
  if (option.kind === "custom") {
    const fullRule = option.rule ?? "";

    // 앞뒤의 ^ $ 를 떼어 낸 규칙으로 패턴을 만든다.
    const { core: rule, endAnchored } =
      splitRuleAnchors(fullRule);

    const regex = buildCustomRulePattern(
      rule,
      endAnchored
    );

    if (!regex) {
      return candidates;
    }

    const bracket = getClosingBracket(rule);

    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      const match = trimmed.match(regex);

      if (!match) {
        return;
      }

      candidates.push({
        lineIndex,
        number: Number(match[1]),
        title: stripClosingBracket(
          match[2]?.trim() || "",
          bracket
        ),
        raw: line,
        pattern: `custom:${fullRule}`,
        score: 0,
        label: buildCustomLabel(rule, Number(match[1])),
      });
    });

    return candidates;
  }

  const names = new Set(option.patternNames ?? []);

  const activePatterns = patterns.filter((pattern) =>
    names.has(pattern.name)
  );

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    for (const pattern of activePatterns) {
      const match = trimmed.match(pattern.regex);

      if (!match) {
        continue;
      }

      candidates.push({
        lineIndex,
        number: pattern.getNumber?.(match),
        title: pattern.getTitle?.(match) || "",
        raw: line,
        pattern: pattern.name,
        score: 0,
      });

      break;
    }
  });

  return candidates;
}
