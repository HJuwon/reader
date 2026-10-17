import {
  DEFAULT_RULE_KEY,
  buildRuleOptions,
  detectBestRule,
  findRuleOption,
  parseNovel,
  type EpisodeRule,
  type ParsedNovel,
  type RuleOption,
} from "@/lib/parser";

export type RuleSource = "manual" | "auto" | "default";

export type RuleSelection = {
  key: string;
  /** manual: 직접 고름 / auto: 자동 감지 / default: 감지 실패 → 기본값 */
  source: RuleSource;
};

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
  ruleSelection: RuleSelection;
  selectedRuleOption: RuleOption;
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
    savedRuleResponse,
  ] = await Promise.all([
    fetch(
      `/api/drive/file-info?fileId=${encodedFileId}`
    ),
    fetch(
      `/api/drive/file?fileId=${encodedFileId}`
    ),
    fetch("/api/episode-rules"),
    fetch(
      `/api/book-episode-rule?fileId=${encodedFileId}`
    ),
  ]);

  const [
    infoData,
    fileData,
    rulesData,
    savedRuleData,
  ] = await Promise.all([
    readJson(infoResponse),
    readJson(fileResponse),
    readJson(rulesResponse),
    readJson(savedRuleResponse),
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

  /**
   * 이 소설에 적용할 규칙 하나를 정한다.
   *   1. 직접 골라서 저장해 둔 규칙
   *   2. 없으면 자동 감지 (번호가 이어지는 형식)
   *   3. 감지가 불확실하면 기본값 "N화"
   */
  const ruleOptions = buildRuleOptions(episodeRules);

  const savedKey =
    savedRuleResponse.ok &&
    typeof savedRuleData === "object" &&
    savedRuleData !== null &&
    "data" in savedRuleData &&
    typeof (
      savedRuleData as {
        data?: { rule_key?: unknown } | null;
      }
    ).data?.rule_key === "string"
      ? (
          savedRuleData as {
            data: { rule_key: string };
          }
        ).data.rule_key
      : null;

  let ruleSelection: RuleSelection;

  if (findRuleOption(ruleOptions, savedKey)) {
    ruleSelection = {
      key: savedKey as string,
      source: "manual",
    };
  } else {
    const detection = detectBestRule(
      file.content,
      ruleOptions
    );

    ruleSelection = detection.recommendedKey
      ? { key: detection.recommendedKey, source: "auto" }
      : { key: DEFAULT_RULE_KEY, source: "default" };
  }

  const selectedRuleOption = findRuleOption(
    ruleOptions,
    ruleSelection.key
  ) as RuleOption;

  const parsedNovel = parseNovel(
    file.content,
    selectedRuleOption
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
    ruleSelection,
    selectedRuleOption,
  };
}
