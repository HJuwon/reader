export type EpisodeCandidate = {
  lineIndex: number;
  number?: number;
  title: string;
  raw: string;
  pattern: string;
  score: number;
};

export type Episode = {
  episode: number;
  title: string;
  content: string;
  startLine: number;
  endLine: number;
};

export type ParsedNovel = {
  episodes: Episode[];
  preface: string;
  totalEpisodes: number;
};