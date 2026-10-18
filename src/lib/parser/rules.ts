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
  /** 수정 창을 열 때 처음 채워 줄 규칙 글자 (정규식으로 만든 기본 항목용) */
  seedRule?: string;
  /** 기본 규칙을 내가 고쳐 쓰고 있는 중 */
  overridden?: boolean;
};

export const DEFAULT_RULE_KEY = "builtin:ko_episode";

/** 규칙 글자 비교용: 앞뒤 공백과 맨 앞의 ^ 는 뜻이 같으므로 지운다. */
export function normalizeRuleText(rule: string): string {
  return rule.trim().replace(/^\^/, "").trim();
}

export function customRuleKey(rule: string): string {
  return `custom:${normalizeRuleText(rule)}`;
}

/** 규칙 글자로 만든 기본 항목. 지울 수 없고, 직접 추가한 규칙과 같은 방식으로 동작한다. */
function textRule(rule: string, hint: string): RuleOption {
  return {
    key: customRuleKey(rule),
    kind: "builtin",
    label: rule,
    hint,
    rule,
  };
}

/**
 * 기본 제공 규칙 목록.
 *
 * 표기법:
 *   xxx  번호가 들어갈 자리
 *   *    아무 글자 (소설 제목 등)
 *   $    줄이 거기서 끝나야 함 (뒤에 글자가 더 있으면 제외)
 *   ^    줄 맨 앞 (원래 항상 줄 맨 앞부터 보므로 생략 가능)
 *
 * 뒤에 $ 가 없는 규칙은 번호 뒤에 제목이 올 수 있다.
 */
export const BUILTIN_RULE_OPTIONS: RuleOption[] = [
  textRule("xxx화$", "1화"),
  textRule("제xxx화$", "제1화"),
  {
    key: "builtin:ko_episode",
    kind: "builtin",
    seedRule: "xxx화",
    label: "xxx화",
    hint: "1화 제목, 제1화 - 제목, [1화], (1화), -1화- (뒤에 제목 가능)",
    patternNames: [
      "korean_episode",
      "bracket_episode",
      "parenthesis_episode",
      "decorated_episode",
    ],
  },
  textRule("* xxx화$", "소설제목 1화 (줄이 화로 끝남)"),
  {
    key: "builtin:titled_episode",
    kind: "builtin",
    seedRule: "* xxx화",
    label: "* xxx화",
    hint: "소설제목 1화, 소설제목 1화 - 부제 (앞 글자는 아무거나)",
    patternNames: ["titled_episode"],
  },
  textRule("xxx장$", "1장"),
  textRule("제xxx장$", "제1장"),
  {
    key: "builtin:ko_chapter",
    kind: "builtin",
    seedRule: "xxx장",
    label: "xxx장",
    hint: "1장 제목, 제1장 - 제목 (뒤에 제목 가능)",
    patternNames: ["korean_chapter"],
  },
  textRule("* xxx장$", "소설제목 1장 (줄이 장으로 끝남)"),
  {
    key: "builtin:en_chapter",
    kind: "builtin",
    seedRule: "Chapter xxx",
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
    seedRule: "Episode xxx",
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
    seedRule: "Part xxx",
    label: "Part N",
    hint: "Part 1, Pt.1",
    patternNames: ["part"],
  },
  {
    key: "builtin:zh",
    kind: "builtin",
    seedRule: "第xxx話",
    label: "第N話 / 第N章",
    hint: "第1話, 第1章",
    patternNames: [
      "chinese_episode",
      "chinese_chapter",
    ],
  },
  // 기호 형식: 뒤에 $ 가 붙은 규칙은 줄에 그것만 있을 때만 잡는다.
  // (본문의 소수점 숫자, 번호 목록 같은 줄이 섞이지 않는다)
  textRule("#xxx.$", "#001."),
  textRule("#xxx.", "#001. 제목"),
  textRule("#xxx$", "#1"),
  textRule("#xxx", "#1 제목"),
  textRule("#xxx화$", "#1화"),
  textRule("#xxx화", "#1화 제목"),
  textRule("xxx.$", "1."),
  textRule("xxx.", "1. 제목"),
  textRule("xxx :$", "1 :"),
  textRule("xxx :", "1 : 제목"),
  textRule("xxx)$", "1)"),
  textRule("xxx)", "1) 제목"),
  textRule("[xxx]$", "[1]"),
  textRule("[xxx]", "[1] 제목"),
  textRule("<xxx>$", "<1>"),
  textRule("<xxx>", "<1> 제목"),
  textRule("< xxx화>$", "< 1화>"),
  textRule("< xxx화", "< 1화 제목>"),
];

export const DEFAULT_RULE_OPTION: RuleOption =
  BUILTIN_RULE_OPTIONS.find(
    (option) => option.key === DEFAULT_RULE_KEY
  ) ?? BUILTIN_RULE_OPTIONS[0];

/**
 * 기본 규칙을 고쳐 쓴 내용은 규칙 목록(episode_rules)에 특별한 형식의 한 줄로 저장한다.
 *   "@@override@@<기본 규칙 키>\n<고친 규칙 글자>"
 * 그래서 DB 테이블을 따로 만들 필요가 없다. 목록을 만들 때만 이 줄을 해석하고,
 * 일반 규칙으로는 보이지 않는다.
 */
const OVERRIDE_PREFIX = "@@override@@";

export function encodeRuleOverride(
  baseKey: string,
  text: string
): string {
  return `${OVERRIDE_PREFIX}${baseKey}\n${text.trim()}`;
}

export function parseRuleOverride(
  rule: string
): { baseKey: string; text: string } | null {
  if (!rule.startsWith(OVERRIDE_PREFIX)) {
    return null;
  }

  const body = rule.slice(OVERRIDE_PREFIX.length);
  const newline = body.indexOf("\n");

  if (newline === -1) {
    return null;
  }

  return {
    baseKey: body.slice(0, newline),
    text: body.slice(newline + 1),
  };
}

/** 내가 추가한 규칙의 키. 글자를 고쳐도 키가 바뀌지 않도록 id를 쓴다. */
export function customRuleOptionKey(id: string): string {
  return `rule:${id}`;
}

/**
 * 기본 규칙 + 사용자가 추가한 규칙을 하나의 목록으로 합친다.
 * - 기본 규칙을 고쳐 쓴 내용이 있으면 그 글자로 바꿔서 보여준다. (키는 그대로)
 * - 사용자가 추가한 규칙이 기본 규칙과 같은 글자이면(^ 유무 무시) 기본 항목 하나만 보인다.
 */
export function buildRuleOptions(
  customRules: EpisodeRule[]
): RuleOption[] {
  const overrides = new Map<string, string>();
  const plainRules: EpisodeRule[] = [];

  customRules.forEach((item) => {
    const override = parseRuleOverride(item.rule);

    if (override) {
      overrides.set(override.baseKey, override.text);
    } else {
      plainRules.push(item);
    }
  });

  const base: RuleOption[] = BUILTIN_RULE_OPTIONS.map(
    (option) => {
      const text = overrides.get(option.key);

      if (!text) {
        return option;
      }

      return {
        ...option,
        label: text,
        rule: text,
        hint: `${option.hint ?? ""} · 내가 고쳐 쓰는 중`,
        overridden: true,
      };
    }
  );

  const seenText = new Set<string>(
    base.map((option) =>
      normalizeRuleText(option.rule ?? "")
    )
  );

  const customs: RuleOption[] = [];

  plainRules.forEach((item) => {
    const text = normalizeRuleText(item.rule);

    if (seenText.has(text)) {
      return;
    }

    seenText.add(text);

    customs.push({
      key: customRuleOptionKey(item.id ?? `text:${text}`),
      kind: "custom",
      label: item.rule,
      rule: item.rule,
      ruleId: item.id,
    });
  });

  return [...base, ...customs];
}

/**
 * 키로 규칙을 찾는다.
 * 예전에 저장된 "custom:^* xxx화$" 같은 키도 ^ 를 뗀 같은 규칙으로 찾아 준다.
 */
export function findRuleOption(
  options: RuleOption[],
  key: string | null | undefined
): RuleOption | null {
  if (!key) {
    return null;
  }

  const exact = options.find((option) => option.key === key);

  if (exact) {
    return exact;
  }

  // 예전 형식의 키("custom:<규칙 글자>")는 같은 글자의 규칙으로 찾아 준다.
  if (key.startsWith("custom:")) {
    const text = normalizeRuleText(
      key.slice("custom:".length)
    );

    return (
      options.find(
        (option) =>
          option.rule !== undefined &&
          normalizeRuleText(option.rule) === text
      ) ?? null
    );
  }

  return null;
}

/**
 * 한 소설에 여러 규칙을 고를 수 있으므로, 저장할 때는 키 목록을 JSON 문자열로 묶는다.
 * (예전에 저장된 단일 키 문자열도 읽을 수 있다.)
 */
export function serializeRuleKeys(keys: string[]): string {
  return JSON.stringify(keys);
}

export function parseRuleKeys(
  raw: string | null | undefined
): string[] {
  if (!raw) {
    return [];
  }

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);

      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is string =>
              typeof item === "string"
          )
        : [];
    } catch {
      return [];
    }
  }

  return [raw];
}
