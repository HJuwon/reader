import { readJsonSafe } from "@/lib/safeJson";
import {
  DEFAULT_RULE_KEY,
  buildRuleOptions,
  detectBestRule,
  findRuleOption,
  parseNovel,
  parseRuleKeys,
  type EpisodeRule,
  type ParsedNovel,
  type RuleOption,
} from "@/lib/parser";

export type RuleSource = "manual" | "auto" | "default";

export type RuleSelection = {
  /** 이 소설에 적용 중인 규칙들 (하나 이상) */
  keys: string[];
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
  selectedRuleOptions: RuleOption[];
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
    return await readJsonSafe(response);
  } catch {
    return null;
  }
}

export type LoadNovelOptions = {
  /**
   * 파일 정보(이름)가 도착하면 본문을 다 받기 전에 먼저 알려 준다.
   * 읽기 정보 불러오기를 본문 다운로드와 겹쳐서 시작하는 데 쓴다.
   */
  onFileInfo?: (info: { name: string }) => void;
};

export async function loadNovel(
  fileId: string,
  options: LoadNovelOptions = {}
): Promise<LoadedNovel> {
  const encodedFileId =
    encodeURIComponent(fileId);

  const infoPromise = fetch(
    `/api/drive/file-info?fileId=${encodedFileId}`
  );

  const filePromise = fetch(
    `/api/drive/file?fileId=${encodedFileId}&raw=1`
  );

  const rulesPromise = fetch("/api/episode-rules");

  const savedRulePromise = fetch(
    `/api/book-episode-rule?fileId=${encodedFileId}`
  );

  // 정보 응답은 작아서 먼저 오니, 이름을 알게 되는 즉시 알려 준다.
  if (options.onFileInfo) {
    const notify = options.onFileInfo;

    void infoPromise
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const data = await readJson(response.clone());
        const name = (data as { name?: unknown } | null)?.name;

        if (typeof name === "string") {
          notify({ name });
        }
      })
      .catch(() => undefined);
  }

  const [
    infoResponse,
    fileResponse,
    rulesResponse,
    savedRuleResponse,
  ] = await Promise.all([
    infoPromise,
    filePromise,
    rulesPromise,
    savedRulePromise,
  ]);

  // 본문(fileResponse)은 JSON이 아니라 글자 그대로 오므로 따로 읽는다.
  // 오류일 때만 JSON(오류 문구)으로 온다.
  const [
    infoData,
    fileContentOrError,
    rulesData,
    savedRuleData,
  ] = await Promise.all([
    readJson(infoResponse),
    fileResponse.ok
      ? fileResponse.text()
      : readJson(fileResponse),
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
        fileContentOrError,
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

  const file = {
    content: fileContentOrError,
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

  const savedKeysRaw =
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

  // 삭제된 규칙은 걸러낸다.
  // 예전 형식의 키(예: "custom:^* xxx화$")도 같은 규칙의 현재 키로 바꾼다.
  const savedKeys = Array.from(
    new Set(
      parseRuleKeys(savedKeysRaw)
        .map(
          (key) => findRuleOption(ruleOptions, key)?.key
        )
        .filter((key): key is string => !!key)
    )
  );

  let ruleSelection: RuleSelection;

  if (savedKeys.length > 0) {
    ruleSelection = { keys: savedKeys, source: "manual" };
  } else {
    const detection = detectBestRule(
      file.content,
      ruleOptions
    );

    ruleSelection = detection.recommendedKey
      ? {
          keys: [detection.recommendedKey],
          source: "auto",
        }
      : { keys: [DEFAULT_RULE_KEY], source: "default" };
  }

  const selectedRuleOptions = ruleSelection.keys
    .map((key) => findRuleOption(ruleOptions, key))
    .filter((option): option is RuleOption => !!option);

  const parsedNovel = parseNovel(
    file.content,
    selectedRuleOptions
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
    selectedRuleOptions,
  };
}
