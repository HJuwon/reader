export type EpisodeRule = {
  id?: string;
  rule: string;
};

export type EpisodeCandidate = {
  lineIndex: number;
  number?: number;
  title: string;
  raw: string;
  pattern: string;
  score: number;
  /** 목록에 보여줄 이름 (예: "외전 1화"). 없으면 "N화"로 표시 */
  label?: string;
};

export type Episode = {
  episode: number;
  title: string;
  label?: string;
  content: string;
  startLine: number;
  endLine: number;
};

export type ParsedNovel = {
  episodes: Episode[];
  preface: string;
  totalEpisodes: number;
};
