"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	DEFAULT_RULE_KEY,
	buildRuleOptions,
	customRuleKey,
	detectBestRule,
	findRuleOption,
	parseNovel,
	type EpisodeRule,
	type ParsedNovel,
	type RuleOption,
} from "@/lib/parser";

import type {
	RuleSelection,
	RuleSource,
} from "../utils/novelLoader";

type UseEpisodeRulesParams = {
	fileId: string | null;
	fileContent: string;
	selectedEpisodeStartLine?: number;
	selectedEpisodeIndex: number;
	episodeRuleManagerOpen: boolean;
	setParsedNovel: (
		novel: ParsedNovel
	) => void;
	setSelectedEpisodeIndex: (
		index: number
	) => void;
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
		const errorValue =
			(data as {
				error?: unknown;
			}).error;

		if (
			typeof errorValue ===
			"string"
		) {
			return errorValue;
		}

		if (
			typeof errorValue ===
				"object" &&
			errorValue !== null &&
			"message" in errorValue
		) {
			const message =
				(
					errorValue as {
						message?: unknown;
					}
				).message;

			if (
				typeof message ===
				"string"
			) {
				return message;
			}
		}

		if (errorValue) {
			try {
				return JSON.stringify(
					errorValue
				);
			} catch {
				return fallback;
			}
		}
	}

	return fallback;
}

export function useEpisodeRules({
	fileId,
	fileContent,
	selectedEpisodeStartLine,
	selectedEpisodeIndex,
	episodeRuleManagerOpen,
	setParsedNovel,
	setSelectedEpisodeIndex,
}: UseEpisodeRulesParams) {
	/* 사용자가 추가한 규칙들 (모든 소설이 공유하는 목록) */
	const [episodeRules, setEpisodeRules] =
		useState<EpisodeRule[]>([]);

	const [episodeRuleInput, setEpisodeRuleInput] =
		useState("");

	const [episodeRulesLoading, setEpisodeRulesLoading] =
		useState(false);

	const [episodeRuleSaving, setEpisodeRuleSaving] =
		useState(false);

	const [episodeRuleError, setEpisodeRuleError] =
		useState("");

	const [episodeRuleSearch, setEpisodeRuleSearch] =
		useState("");

	/* 이 소설에 적용 중인 규칙 / 목록에서 고르는 중인 규칙 */
	const [selectedRuleKey, setSelectedRuleKey] =
		useState<string>(DEFAULT_RULE_KEY);

	const [pendingRuleKey, setPendingRuleKey] =
		useState<string>(DEFAULT_RULE_KEY);

	const [ruleSource, setRuleSource] =
		useState<RuleSource>("default");

	const ruleOptions = useMemo(
		() => buildRuleOptions(episodeRules),
		[episodeRules]
	);

	const selectedRuleOption = useMemo<RuleOption>(
		() =>
			findRuleOption(ruleOptions, selectedRuleKey) ??
			ruleOptions[0],
		[ruleOptions, selectedRuleKey]
	);

	/*
	 * 관리 창을 열었을 때만 모든 규칙을 본문에 돌려본다.
	 * (규칙별 회차 수 표시 + "추천" 항목)
	 */
	const detection = useMemo(() => {
		if (!episodeRuleManagerOpen || !fileContent) {
			return null;
		}

		return detectBestRule(fileContent, ruleOptions);
	}, [episodeRuleManagerOpen, fileContent, ruleOptions]);

	const ruleStats = detection?.stats ?? null;
	const recommendedRuleKey =
		detection?.recommendedKey ?? null;

	useEffect(() => {
		if (!episodeRuleManagerOpen) {
			setEpisodeRuleSearch("");
			return;
		}

		setPendingRuleKey(selectedRuleKey);
		// 창을 열 때만 현재 적용 중인 규칙으로 되돌린다.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [episodeRuleManagerOpen]);

	const filteredRuleOptions = useMemo(() => {
		const keyword = episodeRuleSearch
			.trim()
			.toLowerCase();

		if (!keyword) {
			return ruleOptions;
		}

		return ruleOptions.filter(
			(option) =>
				option.label
					.toLowerCase()
					.includes(keyword) ||
				(option.hint ?? "")
					.toLowerCase()
					.includes(keyword)
		);
	}, [ruleOptions, episodeRuleSearch]);

	const setRuleSelection = useCallback(
		(selection: RuleSelection) => {
			setSelectedRuleKey(selection.key);
			setPendingRuleKey(selection.key);
			setRuleSource(selection.source);
		},
		[]
	);

	/* 선택한 규칙으로 다시 나누고, 보고 있던 회차 위치는 최대한 유지한다. */
	const reparseWithOption = useCallback(
		(option: RuleOption) => {
			if (!fileContent) {
				return;
			}

			const nextParsed = parseNovel(
				fileContent,
				option
			);

			setParsedNovel(nextParsed);

			if (
				typeof selectedEpisodeStartLine === "number"
			) {
				const nextIndex =
					nextParsed.episodes.findIndex(
						(episode) =>
							episode.startLine ===
							selectedEpisodeStartLine
					);

				if (nextIndex >= 0) {
					setSelectedEpisodeIndex(nextIndex);
					return;
				}
			}

			setSelectedEpisodeIndex(
				Math.min(
					selectedEpisodeIndex,
					Math.max(
						0,
						nextParsed.episodes.length - 1
					)
				)
			);
		},
		[
			fileContent,
			selectedEpisodeStartLine,
			selectedEpisodeIndex,
			setParsedNovel,
			setSelectedEpisodeIndex,
		]
	);

	/* 이 소설의 규칙 선택을 서버에 저장한다. 실패하면 예외를 던진다. */
	const persistRuleChoice = useCallback(
		async (ruleKey: string) => {
			if (!fileId) {
				throw new Error(
					"파일 정보를 찾을 수 없습니다."
				);
			}

			const response = await fetch(
				"/api/book-episode-rule",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						fileId,
						ruleKey,
					}),
				}
			);

			if (!response.ok) {
				let data: unknown = null;

				try {
					data = await response.json();
				} catch {
					data = null;
				}

				throw new Error(
					extractErrorMessage(
						data,
						"회차 규칙을 저장하지 못했습니다."
					)
				);
			}
		},
		[fileId]
	);

	/* 목록에서 고른 규칙을 "확인"으로 적용한다. */
	const confirmRuleSelection = useCallback(
		async (): Promise<boolean> => {
			const option = findRuleOption(
				ruleOptions,
				pendingRuleKey
			);

			if (!option) {
				return false;
			}

			if (
				option.key === selectedRuleKey &&
				ruleSource === "manual"
			) {
				return true;
			}

			setEpisodeRuleSaving(true);
			setEpisodeRuleError("");

			try {
				await persistRuleChoice(option.key);

				reparseWithOption(option);

				setSelectedRuleKey(option.key);
				setRuleSource("manual");

				return true;
			} catch (error) {
				console.error(
					"회차 규칙 적용 실패:",
					error
				);

				setEpisodeRuleError(
					error instanceof Error
						? error.message
						: "회차 규칙을 저장하지 못했습니다."
				);

				return false;
			} finally {
				setEpisodeRuleSaving(false);
			}
		},
		[
			ruleOptions,
			pendingRuleKey,
			selectedRuleKey,
			ruleSource,
			persistRuleChoice,
			reparseWithOption,
		]
	);

	const loadEpisodeRules = useCallback(async () => {
		setEpisodeRulesLoading(true);
		setEpisodeRuleError("");

		try {
			const response = await fetch(
				"/api/episode-rules"
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(
					extractErrorMessage(
						data,
						"회차 규칙을 불러오지 못했습니다."
					)
				);
			}

			setEpisodeRules(
				Array.isArray(data?.data) ? data.data : []
			);
		} catch (error) {
			console.error(
				"회차 규칙 불러오기 실패:",
				error
			);

			setEpisodeRuleError(
				error instanceof Error
					? error.message
					: "회차 규칙을 불러오지 못했습니다."
			);
		} finally {
			setEpisodeRulesLoading(false);
		}
	}, []);

	/*
	 * 규칙 추가: 목록에 넣고 바로 이 소설에 선택한다.
	 * 단, 이 소설에서 한 화도 잡히지 않는 규칙이면 적용하지 않는다.
	 */
	const addEpisodeRule = useCallback(async () => {
		const rule = episodeRuleInput.trim();

		if (!rule) {
			return;
		}

		if (!rule.includes("xxx")) {
			setEpisodeRuleError(
				"규칙에는 xxx가 포함되어야 합니다."
			);
			return;
		}

		setEpisodeRuleSaving(true);
		setEpisodeRuleError("");

		try {
			const response = await fetch(
				"/api/episode-rules",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ rule }),
				}
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(
					extractErrorMessage(
						data,
						"회차 규칙을 추가하지 못했습니다."
					)
				);
			}

			if (data?.data) {
				const addedRule = data.data as EpisodeRule;

				const nextRules = episodeRules.some(
					(item) =>
						item.id === addedRule.id ||
						item.rule === addedRule.rule
				)
					? episodeRules
					: [...episodeRules, addedRule];

				setEpisodeRules(nextRules);

				const option = findRuleOption(
					buildRuleOptions(nextRules),
					customRuleKey(addedRule.rule)
				);

				if (option) {
					setPendingRuleKey(option.key);

					const matched = fileContent
						? parseNovel(fileContent, option)
								.episodes.length
						: 0;

					if (matched === 0) {
						setEpisodeRuleError(
							"규칙은 추가했지만, 이 소설에서는 맞는 회차를 찾지 못해 적용하지 않았습니다."
						);
					} else {
						await persistRuleChoice(option.key);

						reparseWithOption(option);

						setSelectedRuleKey(option.key);
						setRuleSource("manual");
					}
				}
			}

			setEpisodeRuleInput("");
		} catch (error) {
			console.error("회차 규칙 추가 실패:", error);

			setEpisodeRuleError(
				error instanceof Error
					? error.message
					: "회차 규칙을 추가하지 못했습니다."
			);
		} finally {
			setEpisodeRuleSaving(false);
		}
	}, [
		episodeRuleInput,
		episodeRules,
		fileContent,
		persistRuleChoice,
		reparseWithOption,
	]);

	/*
	 * 규칙 삭제. 지금 이 소설에 적용 중인 규칙을 지우면
	 * 남은 규칙 중에서 자동 감지로 다시 고른다.
	 */
	const deleteEpisodeRule = useCallback(
		async (id: string) => {
			setEpisodeRuleError("");

			try {
				const response = await fetch(
					"/api/episode-rules",
					{
						method: "DELETE",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ id }),
					}
				);

				const data = await response.json();

				if (!response.ok) {
					throw new Error(
						extractErrorMessage(
							data,
							"회차 규칙을 삭제하지 못했습니다."
						)
					);
				}

				const removed = episodeRules.find(
					(item) => item.id === id
				);

				const nextRules = episodeRules.filter(
					(item) => item.id !== id
				);

				setEpisodeRules(nextRules);

				if (!removed) {
					return;
				}

				const removedKey = customRuleKey(
					removed.rule
				);

				if (selectedRuleKey === removedKey) {
					const nextOptions =
						buildRuleOptions(nextRules);

					const recommended = fileContent
						? detectBestRule(
								fileContent,
								nextOptions
							).recommendedKey
						: null;

					const nextKey =
						recommended ?? DEFAULT_RULE_KEY;

					const nextOption = findRuleOption(
						nextOptions,
						nextKey
					);

					if (nextOption) {
						reparseWithOption(nextOption);
					}

					setSelectedRuleKey(nextKey);
					setPendingRuleKey(nextKey);
					setRuleSource(
						recommended ? "auto" : "default"
					);
				} else if (pendingRuleKey === removedKey) {
					setPendingRuleKey(selectedRuleKey);
				}
			} catch (error) {
				console.error("회차 규칙 삭제 실패:", error);

				setEpisodeRuleError(
					error instanceof Error
						? error.message
						: "회차 규칙을 삭제하지 못했습니다."
				);
			}
		},
		[
			episodeRules,
			fileContent,
			pendingRuleKey,
			selectedRuleKey,
			reparseWithOption,
		]
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

		ruleOptions,
		filteredRuleOptions,
		selectedRuleKey,
		selectedRuleOption,
		pendingRuleKey,
		setPendingRuleKey,
		ruleSource,
		ruleStats,
		recommendedRuleKey,
		setRuleSelection,
		confirmRuleSelection,

		loadEpisodeRules,
		addEpisodeRule,
		deleteEpisodeRule,
	};
}
