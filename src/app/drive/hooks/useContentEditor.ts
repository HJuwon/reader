"use client";

import {
  useCallback,
  useState,
} from "react";

import {
  parseNovel,
  type EpisodeRule,
  type ParsedNovel,
} from "@/lib/parser";

import { getLines } from "@/lib/parser/normalize";

type SelectedEpisode = ParsedNovel["episodes"][number];

type UseContentEditorParams = {
  fileContent: string;
  selectedFile: {
    id: string;
  } | null;
  selectedEpisode: SelectedEpisode | undefined;
  episodeRules: EpisodeRule[];
  setFileContent: (content: string) => void;
  setParsedNovel: (
    novel: ParsedNovel | null
  ) => void;
};

export function useContentEditor({
  fileContent,
  selectedFile,
  selectedEpisode,
  episodeRules,
  setFileContent,
  setParsedNovel,
}: UseContentEditorParams) {
  const [editingContent, setEditingContent] =
    useState(false);

  const [editedText, setEditedText] =
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

      setEditError("");
      setEditingContent(true);
    }, [selectedEpisode]);

  const cancelEditingContent =
    useCallback(() => {
      setEditingContent(false);
      setEditedText("");
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
        const lines =
          getLines(fileContent);

        const newLines = [
          ...lines.slice(
            0,
            selectedEpisode.startLine + 1
          ),
          ...editedText.split("\n"),
          ...lines.slice(
            selectedEpisode.endLine + 1
          ),
        ];

        const newFullText =
          newLines.join("\n");

        const response =
          await fetch(
            `/api/drive/file?fileId=${encodeURIComponent(
              selectedFile.id
            )}`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                content: newFullText,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data?.error ===
              "string"
              ? data.error
              : "본문 저장에 실패했습니다."
          );
        }

        setFileContent(
          newFullText
        );

        const reparsed =
          parseNovel(
            newFullText,
            episodeRules
          );

        setParsedNovel(reparsed);

        setEditingContent(false);
        setEditedText("");

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
      episodeRules,
      setFileContent,
      setParsedNovel,
    ]);

  return {
    editingContent,
    editedText,
    savingEdit,
    editError,

    setEditedText,

    startEditingContent,
    cancelEditingContent,
    saveEditedContent,
  };
}