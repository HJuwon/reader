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

/**
 * 본문에 섞여 들어온 "번호만 그럴듯한 줄"을 걸러낸다.
 *
 * 회차 번호는 1, 2, 3… 으로 커져 가는 것이 정상이므로,
 * 번호가 커지는 가장 긴 줄을 "진짜 회차"로 보고 나머지(예: 6화 뒤에 갑자기
 * 나온 "3.")는 뺀다. 번호가 1로 돌아오면(권·외전 시작) 새로 시작한 것으로 본다.
 * 회차 번호가 건너뛰는 것(1, 2, 4, 5)은 문제 삼지 않는다.
 *
 * 걸러내면 절반 넘게 사라질 만큼 번호가 불규칙하면 판단이 틀렸을 수 있으므로
 * 원래 후보를 그대로 둔다.
 */
function pruneOutOfSequence(
  candidates: EpisodeCandidate[]
): EpisodeCandidate[] {
  const numeric = candidates
    .map((candidate, index) => ({
      index,
      number: candidate.number,
    }))
    .filter(
      (item): item is { index: number; number: number } =>
        item.number !== undefined
    );

  if (numeric.length < 3) {
    return candidates;
  }

  const length = new Array<number>(numeric.length).fill(1);
  const previous = new Array<number>(numeric.length).fill(-1);

  for (let i = 0; i < numeric.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const canFollow =
        numeric[j].number < numeric[i].number ||
        numeric[i].number === 1;

      if (canFollow && length[j] + 1 > length[i]) {
        length[i] = length[j] + 1;
        previous[i] = j;
      }
    }
  }

  let end = 0;

  for (let i = 1; i < numeric.length; i += 1) {
    if (length[i] > length[end]) {
      end = i;
    }
  }

  if (length[end] * 2 < numeric.length) {
    return candidates;
  }

  const keep = new Set<number>();

  for (let i = end; i !== -1; i = previous[i]) {
    keep.add(numeric[i].index);
  }

  return candidates.filter(
    (candidate, index) =>
      candidate.number === undefined || keep.has(index)
  );
}

function selectForOption(
  lines: string[],
  option: RuleOption
): EpisodeCandidate[] {
  const detected = detectCandidates(lines, option);

  const scored = scoreCandidates(detected, lines);

  return pruneOutOfSequence(selectCandidates(scored));
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

  return pruneOutOfSequence(
    selectCandidates(scoreCandidates(merged, lines))
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
  let bestSpecificity = -1;

  // 같은 점수일 때의 판단 순서
  //   1) 정확도: 잡은 회차 중 번호가 이어지는 비율이 높은 쪽
  //      (본문 줄을 덜 섞어 잡은 쪽. 예: "* xxx화$" > "* xxx화")
  //   2) 우선순위: 내가 추가한 일반 규칙 > 기본 형식 > "아무 글자" 규칙
  //   3) 구체성: 규칙 글자가 더 긴 쪽 (예: "#xxx화" > "#xxx")
  const priorityOf = (option: RuleOption) => {
    if (option.rule !== undefined) {
      return option.rule.includes("*") ? 1 : 3;
    }

    return option.key === "builtin:titled_episode" ? 0 : 2;
  };

  const specificityOf = (option: RuleOption) =>
    (option.rule ?? "").length;

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

    if (sequential > 0) {
      const priority = priorityOf(option);
      const specificity = specificityOf(option);

      // 정확도 비교: sequential / count (곱셈으로 비교)
      const precisionDiff =
        sequential * bestCount -
        bestSequential * selected.length;

      const better =
        bestKey === null ||
        sequential > bestSequential ||
        (sequential === bestSequential &&
          (precisionDiff > 0 ||
            (precisionDiff === 0 &&
              (priority > bestPriority ||
                (priority === bestPriority &&
                  specificity > bestSpecificity)))));

      if (better) {
        bestKey = option.key;
        bestSequential = sequential;
        bestCount = selected.length;
        bestPriority = priority;
        bestSpecificity = specificity;
      }
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
  customRuleOptionKey,
  encodeRuleOverride,
  findRuleOption,
  parseRuleOverride,
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

/* ───────── 회차 점검 ───────── */

export type InspectIssue = {
  kind: "gap" | "duplicate" | "dropped";
  /** 화면에 보여줄 설명 */
  message: string;
  /** 원문 줄 (있을 때) */
  lines?: string[];
};

export type InspectResult = {
  count: number;
  lastNumber: number | null;
  issues: InspectIssue[];
};

/**
 * 회차가 왜 모자라는지 찾는다.
 *  - gap      : 번호가 건너뛴 곳 (+ 원문에서 그 번호가 들어간 줄)
 *  - duplicate: 같은 번호가 연속으로 두 번 잡힌 곳
 *  - dropped  : 회차 줄처럼 보였지만 점수·번호 흐름 때문에 빠진 줄
 */
export function inspectParsing(
  text: string,
  option: RuleOption | RuleOption[] | null = null
): InspectResult {
  const lines = getLines(normalizeText(text));

  const options = Array.isArray(option)
    ? option
    : option
      ? [option]
      : [DEFAULT_RULE_OPTION];

  const usedLines = new Set<number>();
  const detected: EpisodeCandidate[] = [];

  options
    .flatMap((o) => detectCandidates(lines, o))
    .sort((a, b) => a.lineIndex - b.lineIndex)
    .forEach((candidate) => {
      if (usedLines.has(candidate.lineIndex)) {
        return;
      }

      usedLines.add(candidate.lineIndex);
      detected.push(candidate);
    });

  const scored = scoreCandidates(detected, lines);
  const selected = selectCandidates(scored);
  const finalList = pruneOutOfSequence(selected);

  const keptLines = new Set(
    finalList.map((c) => c.lineIndex)
  );

  const issues: InspectIssue[] = [];
  const shorten = (s: string) =>
    s.trim().length > 60 ? `${s.trim().slice(0, 60)}…` : s.trim();

  // 1) 빠진 줄
  scored.forEach((candidate) => {
    if (keptLines.has(candidate.lineIndex)) {
      return;
    }

    const reason =
      candidate.score < 40
        ? `점수 미달(${candidate.score})`
        : "번호 순서가 맞지 않아 회차에서 제외";

    issues.push({
      kind: "dropped",
      message: `${candidate.lineIndex + 1}번째 줄이 빠졌어요 — ${reason}`,
      lines: [shorten(lines[candidate.lineIndex])],
    });
  });

  // 2) 번호가 건너뛰거나 겹친 곳
  //   - 규칙 이름이 붙은 회차(예: "2부 1화")는 그 규칙 안에서만 번호를 본다.
  //   - 일반 회차(예: "1화", "591화")는 앞의 2부·외전 회차를 포함해
  //     "목록에 표시되는 번호" 흐름이 이어지는지 본다.
  //     (1부 334화 → 2부 256화 → 591화 처럼 이어지면 정상)
  const findHints = (
    from: EpisodeCandidate,
    to: EpisodeCandidate,
    missing: number
  ) => {
    const pattern = new RegExp(`(^|[^0-9])${missing}\\s*화`);

    const hints = lines
      .slice(from.lineIndex, to.lineIndex + 1)
      .filter((l) => l.trim().length <= 80 && pattern.test(l))
      .slice(0, 3)
      .map(shorten);

    return hints.length
      ? hints
      : [`${missing}화가 들어간 줄을 찾지 못했어요`];
  };

  const rangeText = (from: number, to: number) =>
    from === to ? `${from}화` : `${from}~${to}화`;

  // 2-1) 규칙 이름이 붙은 회차: 규칙별로 따로 검사
  const customLast = new Map<string, EpisodeCandidate>();

  finalList.forEach((candidate) => {
    if (!candidate.label || candidate.number === undefined) {
      return;
    }

    const previous = customLast.get(candidate.pattern);
    customLast.set(candidate.pattern, candidate);

    if (!previous || previous.number === undefined) {
      return;
    }

    const prefix = candidate.label.replace(/\s*\d+[^\d\s]*$/, "");
    const p = previous.number;
    const n = candidate.number;

    if (n === p) {
      issues.push({
        kind: "duplicate",
        message: `${prefix} ${p}화가 두 번 잡혔어요 (${previous.lineIndex + 1}, ${candidate.lineIndex + 1}번째 줄)`,
        lines: [
          shorten(lines[previous.lineIndex]),
          shorten(lines[candidate.lineIndex]),
        ],
      });
    } else if (n > p + 1) {
      issues.push({
        kind: "gap",
        message: `${prefix} ${rangeText(p + 1, n - 1)}가 없어요 (${p}화 다음이 ${n}화)`,
        lines: findHints(previous, candidate, p + 1),
      });
    }
  });

  // 2-2) 일반 회차: 2부·외전 번호까지 이어서 검사
  let running = 0;
  let runningFrom: EpisodeCandidate | undefined;

  finalList.forEach((candidate) => {
    if (candidate.label) {
      running += 1;
      runningFrom = candidate;
      return;
    }

    const n = candidate.number;

    if (n === undefined) {
      return;
    }

    if (running > 0 && runningFrom && n !== 1) {
      if (n === running) {
        issues.push({
          kind: "duplicate",
          message: `${n}화가 두 번 잡혔어요 (${runningFrom.lineIndex + 1}, ${candidate.lineIndex + 1}번째 줄)`,
          lines: [
            shorten(lines[runningFrom.lineIndex]),
            shorten(lines[candidate.lineIndex]),
          ],
        });
      } else if (n > running + 1) {
        issues.push({
          kind: "gap",
          message: `${rangeText(running + 1, n - 1)}가 없어요 (${running}화 다음이 ${n}화)`,
          lines: findHints(runningFrom, candidate, running + 1),
        });
      }
    }

    running = n;
    runningFrom = candidate;
  });

  const last = finalList[finalList.length - 1];

  return {
    count: finalList.length,
    lastNumber: last?.number ?? null,
    issues: issues.slice(0, 30),
  };
}
