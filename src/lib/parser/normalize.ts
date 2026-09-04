export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function getLines(text: string): string[] {
  return normalizeText(text).split("\n");
}