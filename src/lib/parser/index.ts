import { detectCandidates } from "./detector";
import { buildEpisodes } from "./episode";
import {
  normalizeText,
  getLines,
} from "./normalize";
import {
  scoreCandidates,
  selectCandidates,
} from "./scorer";
import {
  DEFAULT_RULE_OPTION,
  type RuleOption,
} from "./rules";

import type {
  Episode,
  EpisodeCandidate,
  EpisodeRule,
  ParsedNovel,
} from "./types";

function selectForOption(
  lines: string[],
  option: RuleOption
): EpisodeCandidate[] {
  const detected = detectCandidates(lines, option);

  const scored = scoreCandidates(detected, lines);

  return selectCandidates(scored);
}

/**
 * 선택된 규칙들로 회차를 나눈다. (여러 규칙을 함께 쓸 수 있다)
 * 규칙이 없으면 기본 규칙("N화")을 쓴다.
 */
function selectForOptions(
  lines: string[],
  options: RuleOption[]
): EpisodeCandidate[] {
  if (options.length === 1) {
    return selectForOption(lines, options[0]);
  }

  // 규칙마다 찾은 후보를 합친 뒤, 같은 줄은 한 번만 쓴다.
  const merged: EpisodeCandidate[] = [];
  const usedLines = new Set<number>();

  options
    .flatMap((option) =>
      detectCandidates(lines, option)
    )
    .sort((a, b) => a.lineIndex - b.lineIndex)
    .forEach((candidate) => {
      if (usedLines.has(candidate.lineIndex)) {
        return;
      }

      usedLines.add(candidate.lineIndex);
      merged.push(candidate);
    });

  return selectCandidates(
    scoreCandidates(merged, lines)
  );
}

export function parseNovel(
  text: string,
  option: RuleOption | RuleOption[] | null = null
): ParsedNovel {
  const lines = getLines(normalizeText(text));

  const options = Array.isArray(option)
    ? option
    : option
      ? [option]
      : [];

  const selected = selectForOptions(
    lines,
    options.length > 0
      ? options
      : [DEFAULT_RULE_OPTION]
  );

  const { episodes, preface } = buildEpisodes(
    lines,
    selected
  );

  return {
    episodes,
    preface,
    totalEpisodes: episodes.length,
  };
}

export type RuleStat = {
  /** 이 규칙으로 잡힌 회차 수 */
  count: number;
  /** 번호가 1, 2, 3… 으로 이어지는 회차 수 */
  sequential: number;
};

export type RuleDetection = {
  stats: Record<string, RuleStat>;
  /** 확신할 수 있을 때만 값이 있다. 없으면 기본 규칙을 써야 한다. */
  recommendedKey: string | null;
};

/** 번호가 이어지는 회차가 이 개수 이상이면 확신한다. */
const MIN_SEQUENTIAL = 3;

/**
 * 모든 규칙을 본문에 돌려보고, 번호가 가장 잘 이어지는 규칙을 추천한다.
 * 점수가 같으면 회차가 더 많이 잡힌 쪽, 그래도 같으면 더 구체적인 규칙이 이긴다.
 */
export function detectBestRule(
  text: string,
  options: RuleOption[]
): RuleDetection {
  const lines = getLines(normalizeText(text));

  const stats: Record<string, RuleStat> = {};

  let bestKey: string | null = null;
  let bestSequential = 0;
  let bestCount = 0;
  let bestPriority = -1;

  // 같은 점수면 더 구체적인 규칙을 고른다.
  // 내가 추가한 일반 규칙 > 기본 형식 > "아무 글자" 규칙(* 규칙, "제목 N화")
  const priorityOf = (option: RuleOption) => {
    if (option.kind === "custom") {
      return option.rule?.includes("*") ? 1 : 3;
    }

    return option.key === "builtin:titled_episode" ? 0 : 2;
  };

  options.forEach((option) => {
    const selected = selectForOption(lines, option);

    // 번호가 1, 2, 3… 으로 이어지는 회차 수.
    // 본문 중에 우연히 섞인 줄(번호가 안 맞는 후보)은 건너뛰고 세고,
    // 번호가 1로 돌아오면(권·외전이 새로 시작) 새 흐름으로 본다.
    let sequential = 0;
    let expected: number | undefined;

    selected.forEach((candidate) => {
      const n = candidate.number;

      if (n === undefined) {
        return;
      }

      if (expected !== undefined && n === expected) {
        sequential += 1;
        expected = n + 1;
      } else if (n === 1) {
        expected = 2;
      } else if (expected === undefined) {
        expected = n + 1;
      }
    });

    stats[option.key] = {
      count: selected.length,
      sequential,
    };

    const priority = priorityOf(option);

    if (
      sequential > bestSequential ||
      (sequential === bestSequential &&
        sequential > 0 &&
        (selected.length > bestCount ||
          (selected.length === bestCount &&
            priority > bestPriority)))
    ) {
      bestKey = option.key;
      bestSequential = sequential;
      bestCount = selected.length;
      bestPriority = priority;
    }
  });

  return {
    stats,
    recommendedKey:
      bestSequential >= MIN_SEQUENTIAL
        ? bestKey
        : null,
  };
}

export {
  BUILTIN_RULE_OPTIONS,
  DEFAULT_RULE_KEY,
  DEFAULT_RULE_OPTION,
  buildRuleOptions,
  customRuleKey,
  findRuleOption,
  parseRuleKeys,
  serializeRuleKeys,
} from "./rules";

export type { RuleKind, RuleOption } from "./rules";

export type {
  Episode,
  EpisodeCandidate,
  EpisodeRule,
  ParsedNovel,
} from "./types";
