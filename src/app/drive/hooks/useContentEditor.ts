"use client";

import {
  useCallback,
  useState,
} from "react";

import {
  parseNovel,
  type ParsedNovel,
  type RuleOption,
} from "@/lib/parser";

import { getLines } from "@/lib/parser/normalize";
import {
  applyEpisodeEdit,
  sliceEpisodeText,
  type EpisodeEdit,
} from "@/lib/parser/episodeEdit";

type SelectedEpisode = ParsedNovel["episodes"][number];

type UseContentEditorParams = {
  fileContent: string;
  selectedFile: {
    id: string;
  } | null;
  selectedEpisode: SelectedEpisode | undefined;
  selectedRuleOptions: RuleOption[];
  setFileContent: (content: string) => void;
  setParsedNovel: (
    novel: ParsedNovel | null
  ) => void;
};

export function useContentEditor({
  fileContent,
  selectedFile,
  selectedEpisode,
  selectedRuleOptions,
  setFileContent,
  setParsedNovel,
}: UseContentEditorParams) {
  const [editingContent, setEditingContent] =
    useState(false);

  const [editedText, setEditedText] =
    useState("");

  /* 회차 제목 줄(원문 그대로) */
  const [editedTitle, setEditedTitle] =
    useState("");

  const [savingEdit, setSavingEdit] =
    useState(false);

  const [editError, setEditError] =
    useState("");

  const startEditingContent =
    useCallback(() => {
      if (!selectedEpisode) {
        return;
      }

      setEditedText(
        selectedEpisode.content
      );

      setEditedTitle(
        getLines(fileContent)[
          selectedEpisode.startLine
        ] ?? ""
      );

      setEditError("");
      setEditingContent(true);
    }, [selectedEpisode, fileContent]);

  const cancelEditingContent =
    useCallback(() => {
      setEditingContent(false);
      setEditedText("");
      setEditedTitle("");
      setEditError("");
    }, []);

  const saveEditedContent =
    useCallback(async () => {
      if (
        !selectedFile ||
        !selectedEpisode
      ) {
        return false;
      }

      setSavingEdit(true);
      setEditError("");

      try {
        // 제목 줄은 한 줄이어야 하므로 줄바꿈은 공백으로 바꾼다.
        const titleLine =
          editedTitle.replace(/\s*[\r\n]+\s*/g, " ");

        // 책 전체가 아니라 고친 회차만 서버로 보낸다.
        // (전체를 보내면 Vercel 요청 크기 제한에 걸린다)
        const edit: EpisodeEdit = {
          startLine: selectedEpisode.startLine,
          endLine: selectedEpisode.endLine,
          titleLine,
          text: editedText,
          expectedOld: sliceEpisodeText(
            fileContent,
            selectedEpisode.startLine,
            selectedEpisode.endLine
          ),
        };

        const newFullText =
          applyEpisodeEdit(fileContent, edit);

        const response =
          await fetch(
            `/api/drive/file?fileId=${encodeURIComponent(
              selectedFile.id
            )}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                edit,
              }),
            }
          );

        // 서버가 JSON이 아닌 오류(예: 크기 초과)를 돌려줘도 읽을 수 있게 한다.
        const raw = await response.text();

        let data: { error?: unknown } | null = null;

        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : `본문 저장에 실패했습니다. (오류 ${response.status})`
          );
        }

        setFileContent(
          newFullText
        );

        const reparsed =
          parseNovel(
            newFullText,
            selectedRuleOptions
          );

        setParsedNovel(reparsed);

        setEditingContent(false);
        setEditedText("");
        setEditedTitle("");

        return true;
      } catch (error) {
        console.error(
          "본문 저장 실패:",
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : "본문 저장에 실패했습니다.";

        setEditError(message);

        return false;
      } finally {
        setSavingEdit(false);
      }
    }, [
      selectedFile,
      selectedEpisode,
      fileContent,
      editedText,
      editedTitle,
      selectedRuleOptions,
      setFileContent,
      setParsedNovel,
    ]);

  return {
    editingContent,
    editedText,
    editedTitle,
    savingEdit,
    editError,

    setEditedText,
    setEditedTitle,

    startEditingContent,
    cancelEditingContent,
    saveEditedContent,
  };
}
