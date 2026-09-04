import { EpisodeCandidate } from "./types";

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
    regex: /^\s*(?:제\s*)?(\d{1,5})\s*화(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "korean_chapter",
    regex: /^\s*(?:제\s*)?(\d{1,5})\s*장(?:\s*[-.:·]\s*|\s+)?(.*?)\s*$/,
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
    regex: /^\s*第\s*(\d{1,5})\s*話\s*(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },

  {
    name: "chinese_chapter",
    regex: /^\s*第\s*(\d{1,5})\s*章\s*(.*?)\s*$/,
    getNumber: (m) => Number(m[1]),
    getTitle: (m) => m[2]?.trim() || "",
  },
];

export function detectCandidates(lines: string[]): EpisodeCandidate[] {
  const candidates: EpisodeCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    for (const pattern of patterns) {
      const match = trimmed.match(pattern.regex);

      if (!match) {
        continue;
      }

      const number = pattern.getNumber?.(match);
      const title = pattern.getTitle?.(match) || "";

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
