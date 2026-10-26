"use client";

import { useCallback } from "react";
import {
  loadNovel,
  type LoadNovelOptions,
  type LoadedNovel,
} from "../utils/novelLoader";

export function useNovelLoader() {
  const loadNovelFile =
    useCallback(
      async (
        fileId: string,
        options?: LoadNovelOptions
      ): Promise<LoadedNovel> => {
        return loadNovel(fileId, options);
      },
      []
    );

  return {
    loadNovelFile,
  };
}