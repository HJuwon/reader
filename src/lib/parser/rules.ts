import type { EpisodeRule } from "./types";

export type RuleKind = "builtin" | "custom";

/**
 * 회차 규칙 목록의 한 항목.
 * - builtin: 코드에 들어 있는 기본 형식 (patternNames로 detector의 정규식을 가리킨다)
 * - custom : 사용자가 추가한 규칙 (예: "외전 제xxx화")
 */
export type RuleOption = {
  key: string;
  kind: RuleKind;
  label: string;
  hint?: string;
  patternNames?: string[];
  rule?: string;
  ruleId?: string;
};

export const DEFAULT_RULE_KEY = "builtin:ko_episode";

export const BUILTIN_RULE_OPTIONS: RuleOption[] = [
  {
    key: "builtin:ko_episode",
    kind: "builtin",
    label: "N화",
    hint: "1화, 제1화, [1화], (1화), -1화-",
    patternNames: [
      "korean_episode",
      "bracket_episode",
      "parenthesis_episode",
      "decorated_episode",
    ],
  },
  {
    key: "builtin:ko_chapter",
    kind: "builtin",
    label: "N장",
    hint: "1장, 제1장",
    patternNames: ["korean_chapter"],
  },
  {
    key: "builtin:en_chapter",
    kind: "builtin",
    label: "Chapter N",
    hint: "Chapter 1, Ch.1, === Chapter 1 ===",
    patternNames: [
      "english_chapter",
      "wrapped_english_chapter",
    ],
  },
  {
    key: "builtin:en_episode",
    kind: "builtin",
    label: "Episode N",
    hint: "Episode 1, Ep.1, === Ep 1 ===",
    patternNames: [
      "english_episode",
      "wrapped_english_episode",
    ],
  },
  {
    key: "builtin:part",
    kind: "builtin",
    label: "Part N",
    hint: "Part 1, Pt.1",
    patternNames: ["part"],
  },
  {
    key: "builtin:zh",
    kind: "builtin",
    label: "第N話 / 第N章",
    hint: "第1話, 第1章",
    patternNames: [
      "chinese_episode",
      "chinese_chapter",
    ],
  },
];

export const DEFAULT_RULE_OPTION: RuleOption =
  BUILTIN_RULE_OPTIONS[0];

export function customRuleKey(rule: string): string {
  return `custom:${rule}`;
}

/**
 * 기본 형식 + 사용자가 추가한 규칙을 하나의 목록으로 합친다.
 */
export function buildRuleOptions(
  customRules: EpisodeRule[]
): RuleOption[] {
  const seen = new Set<string>();

  const customs: RuleOption[] = [];

  customRules.forEach((item) => {
    const key = customRuleKey(item.rule);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    customs.push({
      key,
      kind: "custom",
      label: item.rule,
      rule: item.rule,
      ruleId: item.id,
    });
  });

  return [...BUILTIN_RULE_OPTIONS, ...customs];
}

export function findRuleOption(
  options: RuleOption[],
  key: string | null | undefined
): RuleOption | null {
  if (!key) {
    return null;
  }

  return (
    options.find((option) => option.key === key) ??
    null
  );
}
