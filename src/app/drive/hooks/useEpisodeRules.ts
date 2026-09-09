"use client";

import { useCallback, useMemo, useState } from "react";
import { parseNovel, type EpisodeRule, type ParsedNovel } from "@/lib/parser";

type UseEpisodeRulesParams = {
  fileContent: string;
  selectedEpisodeStartLine?: number;
  selectedEpisodeIndex: number;
  setParsedNovel: (novel: ParsedNovel) => void;
  setSelectedEpisodeIndex: (index: number) => void;
};

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data) {
    const errorValue = (data as { error?: unknown }).error;
    if (typeof errorValue === "string") return errorValue;
    if (typeof errorValue === "object" && errorValue !== null && "message" in errorValue) {
      const message = (errorValue as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (errorValue) {
      try {
        return JSON.stringify(errorValue);
      } catch {
        return fallback;
      }
    }
  }
  return fallback;
}

export function useEpisodeRules({
  fileContent,
  selectedEpisodeStartLine,
  selectedEpisodeIndex,
  setParsedNovel,
  setSelectedEpisodeIndex,
}: UseEpisodeRulesParams) {
  const [episodeRules, setEpisodeRules] = useState<EpisodeRule[]>([]);
  const [episodeRuleInput, setEpisodeRuleInput] = useState("");
  const [episodeRulesLoading, setEpisodeRulesLoading] = useState(false);
  const [episodeRuleSaving, setEpisodeRuleSaving] = useState(false);
  const [episodeRuleError, setEpisodeRuleError] = useState("");
  const [episodeRuleSearch, setEpisodeRuleSearch] = useState("");

  const filteredEpisodeRules = useMemo(() => {
    const keyword = episodeRuleSearch.trim().toLowerCase();
    if (!keyword) return episodeRules;
    return episodeRules.filter((rule) => rule.rule.toLowerCase().includes(keyword));
  }, [episodeRules, episodeRuleSearch]);

  const reparseWithRules = useCallback(
    (rules: EpisodeRule[]) => {
      if (!fileContent) return;

      const nextParsed = parseNovel(fileContent, rules);
      setParsedNovel(nextParsed);

      if (typeof selectedEpisodeStartLine === "number") {
        const nextIndex = nextParsed.episodes.findIndex((episode) => episode.startLine === selectedEpisodeStartLine);
        if (nextIndex >= 0) {
          setSelectedEpisodeIndex(nextIndex);
          return;
        }
      }

      const safeIndex = Math.min(selectedEpisodeIndex, Math.max(0, nextParsed.episodes.length - 1));
      setSelectedEpisodeIndex(safeIndex);
    },
    [fileContent, selectedEpisodeStartLine, selectedEpisodeIndex, setParsedNovel, setSelectedEpisodeIndex]
  );

  const loadEpisodeRules = useCallback(async () => {
    setEpisodeRulesLoading(true);
    setEpisodeRuleError("");

    try {
      const response = await fetch("/api/episode-rules");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "회차 규칙을 불러오지 못했습니다."));
      }

      setEpisodeRules(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      console.error("회차 규칙 불러오기 실패:", error);
      setEpisodeRuleError(error instanceof Error ? error.message : "회차 규칙을 불러오지 못했습니다.");
    } finally {
      setEpisodeRulesLoading(false);
    }
  }, []);

  const addEpisodeRule = useCallback(async () => {
    const rule = episodeRuleInput.trim();

    if (!rule) return;

    if (!rule.includes("xxx")) {
      setEpisodeRuleError("규칙에는 xxx가 포함되어야 합니다.");
      return;
    }

    setEpisodeRuleSaving(true);
    setEpisodeRuleError("");

    try {
      const response = await fetch("/api/episode-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rule,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "회차 규칙을 추가하지 못했습니다."));
      }

      if (data?.data) {
        const addedRule = data.data as EpisodeRule;

        const nextRules = episodeRules.some((item) => item.id === addedRule.id)
          ? episodeRules
          : [...episodeRules, addedRule];

        setEpisodeRules(nextRules);
        reparseWithRules(nextRules);
      }

      setEpisodeRuleInput("");
    } catch (error) {
      console.error("회차 규칙 추가 실패:", error);
      setEpisodeRuleError(error instanceof Error ? error.message : "회차 규칙을 추가하지 못했습니다.");
    } finally {
      setEpisodeRuleSaving(false);
    }
  }, [episodeRuleInput, episodeRules, reparseWithRules]);

  const deleteEpisodeRule = useCallback(
    async (id: string) => {
      setEpisodeRuleError("");

      try {
        const response = await fetch("/api/episode-rules", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(extractErrorMessage(data, "회차 규칙을 삭제하지 못했습니다."));
        }

        const nextRules = episodeRules.filter((item) => item.id !== id);

        setEpisodeRules(nextRules);
        reparseWithRules(nextRules);
      } catch (error) {
        console.error("회차 규칙 삭제 실패:", error);
        setEpisodeRuleError(error instanceof Error ? error.message : "회차 규칙을 삭제하지 못했습니다.");
      }
    },
    [episodeRules, reparseWithRules]
  );

  return {
    episodeRules,
    setEpisodeRules,
    episodeRuleInput,
    setEpisodeRuleInput,
    episodeRulesLoading,
    episodeRuleSaving,
    episodeRuleError,
    episodeRuleSearch,
    setEpisodeRuleSearch,
    filteredEpisodeRules,
    loadEpisodeRules,
    addEpisodeRule,
    deleteEpisodeRule,
    reparseWithRules,
  };
}