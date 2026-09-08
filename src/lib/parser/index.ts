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

import type {
  Episode,
  EpisodeCandidate,
  EpisodeRule,
  ParsedNovel,
} from "./types";

export function parseNovel(
  text: string,
  customRules: EpisodeRule[] = []
): ParsedNovel {
  const normalized =
    normalizeText(text);

  const lines =
    getLines(normalized);

  const detected =
    detectCandidates(
      lines,
      customRules
    );

  const scored =
    scoreCandidates(
      detected,
      lines
    );

  const selected =
    selectCandidates(scored);

  const {
    episodes,
    preface,
  } = buildEpisodes(
    lines,
    selected
  );

  return {
    episodes,
    preface,
    totalEpisodes:
      episodes.length,
  };
}

export type {
  Episode,
  EpisodeCandidate,
  EpisodeRule,
  ParsedNovel,
} from "./types";
