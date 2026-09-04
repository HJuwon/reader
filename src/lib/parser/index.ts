import { detectCandidates } from "./detector";
import { buildEpisodes } from "./episode";
import { normalizeText, getLines } from "./normalize";
import { scoreCandidates, selectCandidates } from "./scorer";
import { ParsedNovel } from "./types";

export function parseNovel(text: string): ParsedNovel {
  const normalized = normalizeText(text);
  const lines = getLines(normalized);

  const detected = detectCandidates(lines);

  const scored = scoreCandidates(detected, lines);

  const selected = selectCandidates(scored);

  const { episodes, preface } = buildEpisodes(lines, selected);

  return {
    episodes,
    preface,
    totalEpisodes: episodes.length,
  };
}

export type {
  Episode,
  EpisodeCandidate,
  ParsedNovel,
} from "./types";