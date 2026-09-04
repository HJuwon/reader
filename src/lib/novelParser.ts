export type ChapterType =
  | "prologue"
  | "chapter"
  | "epilogue"
  | "side_story"
  | "unknown";

export interface ParsedChapter {
  id: string;
  number: number | null;
  title: string;
  content: string;
  type: ChapterType;
}

interface ChapterCandidate {
  lineIndex: number;
  number: number | null;
  title: string;
  type: ChapterType;
  score: number;
}

const KOREAN_NUMBERS: Record<string, number> = {
  영: 0,
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  칠: 7,
  팔: 8,
  구: 9,
  십: 10,
  백: 100,
  천: 1000,
};

function normalizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function normalizeLine(line: string): string {
  return line
    .replace(/\uFEFF/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseKoreanNumber(value: string): number | null {
  const text = value
    .replace(/\s+/g, "")
    .replace(/[화장편회차]/g, "");

  if (/^\d+$/.test(text)) return Number(text);

  const arabic = text.match(/\d+/);
  if (arabic) return Number(arabic[0]);

  if (!text) return null;

  let total = 0;
  let current = 0;
  let found = false;

  for (const char of text) {
    const number = KOREAN_NUMBERS[char];

    if (number === undefined) return null;

    found = true;

    if (number === 10 || number === 100 || number === 1000) {
      if (current === 0) current = 1;

      total += current * number;
      current = 0;
    } else {
      current += number;
    }
  }

  if (!found) return null;

  return total + current;
}

function classifyChapterType(line: string): ChapterType {
  const normalized = line.toLowerCase().replace(/\s+/g, "");

  if (/^(프롤로그|prologue|prolog)\b/.test(normalized)) {
    return "prologue";
  }

  if (/^(에필로그|epilogue|epilog)\b/.test(normalized)) {
    return "epilogue";
  }

  if (
    /^(외전|번외|side\s*story|sidestory|special)\b/.test(
      normalized
    )
  ) {
    return "side_story";
  }

  return "chapter";
}

function extractNumber(line: string): number | null {
  const cleaned = line.replace(/,/g, "").trim();

  /*
   * ============================================================
   * 구분선으로 감싼 Episode / Chapter
   *
   * === Episode 1 ===
   * === Episode1 ===
   * === EP 1 ===
   * === EP1 ===
   * === Chapter 1 ===
   * === Chapter1 ===
   * === CH1 ===
   * ============================================================
   */
  const wrappedChapterPatterns = [
    /^={2,}\s*(?:episode|ep)\s*[.#:_-]?\s*(\d{1,6})\s*={2,}$/i,

    /^={2,}\s*(?:chapter|chap|ch)\s*[.#:_-]?\s*(\d{1,6})\s*={2,}$/i,
  ];

  for (const pattern of wrappedChapterPatterns) {
    const match = cleaned.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  /*
   * 일반적인 회차 표기
   */
  const patterns = [
    /(?:^|[\s\[\]()【】「」『』])(?:제\s*)?(\d{1,6})\s*(?:화|회|장|편|막|부|권)(?:\s|[.:：\-–—|~()【】「」『』]|$)/i,

    /(?:^|[\s\[\]()【】「」『』])(?:chapter|chap|ch)\s*[.#:_-]?\s*(\d{1,6})(?:\s|[.:：\-–—|~()【】「」『』]|$)/i,

    /(?:^|[\s\[\]()【】「」『』])(?:episode|ep)\s*[.#:_-]?\s*(\d{1,6})(?:\s|[.:：\-–—|~()【】「」『』]|$)/i,

    /(?:^|[\s\[\]()【】「」『』])(?:part|pt|volume|vol|story|no)\s*[.#:_-]?\s*(\d{1,6})(?:\s|[.:：\-–—|~()【】「」『』]|$)/i,

    /^#\s*(\d{1,6})(?:\s|[.:：\-–—|~()【】「」『』]|$)/i,

    /^(?:제\s*)?(\d{1,6})\s*[.:：\-–—]\s*(?:\S.*)?$/i,

    /^(?:제\s*)?(\d{1,6})(?:\s|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  /*
   * 한글 숫자 회차
   *
   * 제일화
   * 일화
   * 이십화
   */
  const koreanPatterns = [
    /^(?:제\s*)?([일이삼사오육칠팔구십백천영\s]+)\s*(?:화|회|장|편)(?:\s|[.:：\-–—|~]|$)/,
  ];

  for (const pattern of koreanPatterns) {
    const match = cleaned.match(pattern);

    if (match) {
      return parseKoreanNumber(match[1]);
    }
  }

  return null;
}

function extractTitle(
  line: string,
  number: number | null
): string {
  let title = line.trim();

  /*
   * === Episode 1 ===
   * === Episode1 ===
   *
   * 양쪽 구분선을 먼저 제거한다.
   */
  title = title
    .replace(/^={2,}\s*/, "")
    .replace(/\s*={2,}$/, "")
    .trim();

  title = title
    .replace(/^[#\s]+/, "")
    .replace(
      /^(?:제\s*)?\d{1,6}\s*(?:화|회|장|편|막|부|권)\s*/i,
      ""
    )
    .replace(
      /^(?:chapter|chap|ch|episode|ep|part|pt|volume|vol|story|no)\s*[.#:_-]?\s*\d{1,6}\s*/i,
      ""
    )
    .replace(/^#\s*\d{1,6}\s*/i, "")
    .replace(/^[.:：\-–—|~]+/, "")
    .trim();

  if (number !== null && title === String(number)) {
    return "";
  }

  return title;
}

function isSpecialChapter(line: string): boolean {
  const normalized = line.trim().toLowerCase();

  return /^(프롤로그|에필로그|외전|번외|후일담|prologue|epilogue|prolog|epilog|side\s*story|special)\b/i.test(
    normalized
  );
}

function looksLikeChapterHeading(line: string): boolean {
  const normalized = normalizeLine(line);

  if (!normalized) return false;

  if (normalized.length > 120) return false;

  if (isSpecialChapter(normalized)) return true;

  /*
   * ============================================================
   * 구분선으로 감싼 회차
   *
   * === Episode 1 ===
   * === Episode1 ===
   * === EP 1 ===
   * === EP1 ===
   * === Chapter 1 ===
   * === Chapter1 ===
   * === CH 1 ===
   * === CH1 ===
   * ============================================================
   */
  if (
    /^={2,}\s*(?:chapter|chap|ch|episode|ep)\s*[.#:_-]?\s*\d{1,6}\s*={2,}$/i.test(
      normalized
    )
  ) {
    return true;
  }

  const number = extractNumber(normalized);

  if (number === null) return false;

  if (/^\d{1,6}$/.test(normalized)) {
    return true;
  }

  if (
    /^(?:제\s*)?\d{1,6}\s*(?:화|회|장|편|막|부|권)/i.test(
      normalized
    )
  ) {
    return true;
  }

  if (
    /^(?:chapter|chap|ch|episode|ep|part|pt|volume|vol|story|no)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  if (/^#\s*\d{1,6}/.test(normalized)) {
    return true;
  }

  if (
    /^(?:제\s*)?\d{1,6}\s*[.:：\-–—]/.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

function scoreCandidate(
  lines: string[],
  index: number
): ChapterCandidate | null {
  const line = normalizeLine(lines[index]);

  if (!line) return null;

  const number = extractNumber(line);
  const special = isSpecialChapter(line);

  if (number === null && !special) {
    return null;
  }

  if (!looksLikeChapterHeading(line) && !special) {
    return null;
  }

  let score = 0;

  if (special) {
    score += 8;
  }

  if (number !== null) {
    score += 5;
  }

  /*
   * 구분선으로 감싼 Episode 형식은
   * 매우 명확한 회차 제목이므로 높은 점수를 준다.
   */
  if (
    /^={2,}\s*(?:episode|ep)\s*[.#:_-]?\s*\d{1,6}\s*={2,}$/i.test(
      line
    )
  ) {
    score += 7;
  }

  if (
    /^={2,}\s*(?:chapter|chap|ch)\s*[.#:_-]?\s*\d{1,6}\s*={2,}$/i.test(
      line
    )
  ) {
    score += 7;
  }

  if (
    /^(?:제\s*)?\d{1,6}\s*(?:화|회|장|편|막|부|권)/i.test(
      line
    )
  ) {
    score += 5;
  }

  if (
    /^(?:chapter|chap|ch|episode|ep|part|pt|volume|vol|story|no)\b/i.test(
      line
    )
  ) {
    score += 5;
  }

  if (/^#\s*\d{1,6}/i.test(line)) {
    score += 4;
  }

  if (
    /^(?:제\s*)?\d{1,6}\s*[.:：\-–—]/.test(
      line
    )
  ) {
    score += 3;
  }

  if (line.length <= 60) {
    score += 2;
  }

  if (line.length <= 30) {
    score += 1;
  }

  const previousLines = lines.slice(
    Math.max(0, index - 5),
    index
  );

  const nextLines = lines.slice(
    index + 1,
    index + 6
  );

  if (
    previousLines.some(
      (item) =>
        extractNumber(normalizeLine(item)) !== null
    )
  ) {
    score += 2;
  }

  if (
    nextLines.some(
      (item) =>
        extractNumber(normalizeLine(item)) !== null
    )
  ) {
    score += 2;
  }

  return {
    lineIndex: index,
    number,
    title: extractTitle(line, number),
    type: classifyChapterType(line),
    score,
  };
}

function filterCandidates(
  candidates: ChapterCandidate[]
): ChapterCandidate[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  const result: ChapterCandidate[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const current = candidates[i];
    const previous = candidates[i - 1];
    const next = candidates[i + 1];

    let score = current.score;

    if (
      current.number !== null &&
      previous?.number != null
    ) {
      const difference =
        current.number - previous.number;

      if (difference === 1) {
        score += 8;
      } else if (
        difference > 0 &&
        difference <= 3
      ) {
        score += 4;
      } else if (difference <= 0) {
        score -= 4;
      }
    }

    if (
      current.number !== null &&
      next?.number != null
    ) {
      const difference =
        next.number - current.number;

      if (difference === 1) {
        score += 8;
      } else if (
        difference > 0 &&
        difference <= 3
      ) {
        score += 4;
      } else if (difference <= 0) {
        score -= 4;
      }
    }

    if (score >= 7) {
      result.push({
        ...current,
        score,
      });
    }
  }

  return result;
}

export function parseNovelText(
  text: string
): ParsedChapter[] {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText.split("\n");

  const candidates: ChapterCandidate[] = [];

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const candidate = scoreCandidate(
      lines,
      index
    );

    if (candidate) {
      candidates.push(candidate);
    }
  }

  const filtered = filterCandidates(candidates);

  if (filtered.length === 0) {
    return [
      {
        id: "chapter-1",
        number: 1,
        title: "",
        content: normalizedText,
        type: "unknown",
      },
    ];
  }

  const chapters: ParsedChapter[] = [];

  for (
    let index = 0;
    index < filtered.length;
    index += 1
  ) {
    const current = filtered[index];
    const next = filtered[index + 1];

    const contentStart =
      current.lineIndex + 1;

    const contentEnd = next
      ? next.lineIndex
      : lines.length;

    const content = lines
      .slice(contentStart, contentEnd)
      .join("\n")
      .trim();

    chapters.push({
      id: `chapter-${index + 1}`,
      number: current.number,
      title: current.title,
      content,
      type: current.type,
    });
  }

  return chapters;
}
