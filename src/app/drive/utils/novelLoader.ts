import {
  parseNovel,
  type EpisodeRule,
  type ParsedNovel,
} from "@/lib/parser";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

export type LoadedNovel = {
  file: DriveItem;
  content: string;
  parsedNovel: ParsedNovel;
  episodeRules: EpisodeRule[];
};

function extractErrorMessage(
  data: unknown,
  fallback: string
): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data
  ) {
    const errorValue = (
      data as {
        error?: unknown;
      }
    ).error;

    if (typeof errorValue === "string") {
      return errorValue;
    }

    if (
      typeof errorValue === "object" &&
      errorValue !== null &&
      "message" in errorValue &&
      typeof (
        errorValue as {
          message?: unknown;
        }
      ).message === "string"
    ) {
      return (
        errorValue as {
          message: string;
        }
      ).message;
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

async function readJson(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadNovel(
  fileId: string
): Promise<LoadedNovel> {
  const encodedFileId =
    encodeURIComponent(fileId);

  const [
    infoResponse,
    fileResponse,
    rulesResponse,
  ] = await Promise.all([
    fetch(
      `/api/drive/file-info?fileId=${encodedFileId}`
    ),
    fetch(
      `/api/drive/file?fileId=${encodedFileId}`
    ),
    fetch("/api/episode-rules"),
  ]);

  const [
    infoData,
    fileData,
    rulesData,
  ] = await Promise.all([
    readJson(infoResponse),
    readJson(fileResponse),
    readJson(rulesResponse),
  ]);

  if (!infoResponse.ok) {
    throw new Error(
      extractErrorMessage(
        infoData,
        "파일 정보를 가져오지 못했습니다."
      )
    );
  }

  if (!fileResponse.ok) {
    throw new Error(
      extractErrorMessage(
        fileData,
        "파일을 가져오지 못했습니다."
      )
    );
  }

  const info = infoData as {
    id?: unknown;
    name?: unknown;
    mimeType?: unknown;
    modifiedTime?: unknown;
    size?: unknown;
  };

  const file = fileData as {
    content?: unknown;
  };

  if (
    typeof info.id !== "string" ||
    typeof info.name !== "string" ||
    typeof info.mimeType !== "string"
  ) {
    throw new Error(
      "파일 정보 응답 형식이 올바르지 않습니다."
    );
  }

  if (typeof file.content !== "string") {
    throw new Error(
      "파일 내용이 올바르지 않습니다."
    );
  }

  const episodeRules: EpisodeRule[] =
    rulesResponse.ok &&
    typeof rulesData === "object" &&
    rulesData !== null &&
    "data" in rulesData &&
    Array.isArray(
      (rulesData as {
        data?: unknown;
      }).data
    )
      ? (
          rulesData as {
            data: EpisodeRule[];
          }
        ).data
      : [];

  const parsedNovel =
    parseNovel(
      file.content,
      episodeRules
    );

  const driveItem: DriveItem = {
    id: info.id,
    name: info.name,
    mimeType: info.mimeType,
    modifiedTime:
      typeof info.modifiedTime ===
      "string"
        ? info.modifiedTime
        : undefined,
    size:
      typeof info.size === "string"
        ? info.size
        : undefined,
  };

  return {
    file: driveItem,
    content: file.content,
    parsedNovel,
    episodeRules,
  };
}