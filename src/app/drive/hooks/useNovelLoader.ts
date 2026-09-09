"use client";

import { useCallback } from "react";
import {
  loadNovel,
  type LoadedNovel,
} from "../utils/novelLoader";

export function useNovelLoader() {
  const loadNovelFile =
    useCallback(
      async (
        fileId: string
      ): Promise<LoadedNovel> => {
        return loadNovel(fileId);
      },
      []
    );

  return {
    loadNovelFile,
  };
}