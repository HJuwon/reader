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
	customRuleOptionKey,
	encodeRuleOverride,
	parseRuleOverride,
	detectBestRule,
	findRuleOption,
	parseNovel,
	serializeRuleKeys,
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

	/* 이 소설에 적용 중인 규칙들 / 목록에서 고르는 중인 규칙들 (여러 개 가능) */
	const [selectedRuleKeys, setSelectedRuleKeys] =
		useState<string[]>([DEFAULT_RULE_KEY]);

	const [pendingRuleKeys, setPendingRuleKeys] =
		useState<string[]>([DEFAULT_RULE_KEY]);

	const [ruleSource, setRuleSource] =
		useState<RuleSource>("default");

	/* 이 소설에 안 맞는 규칙까지 전부 펼쳐서 볼지 */
	const [showAllRules, setShowAllRules] =
		useState(false);

	const ruleOptions = useMemo(
		() => buildRuleOptions(episodeRules),
		[episodeRules]
	);

	const selectedRuleOptions = useMemo<RuleOption[]>(() => {
		const found = selectedRuleKeys
			.map((key) => findRuleOption(ruleOptions, key))
			.filter(
				(option): option is RuleOption => !!option
			);

		return found.length > 0 ? found : [ruleOptions[0]];
	}, [ruleOptions, selectedRuleKeys]);

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

		setShowAllRules(false);
		setPendingRuleKeys(selectedRuleKeys);
		// 창을 열 때만 현재 적용 중인 규칙으로 되돌린다.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [episodeRuleManagerOpen]);

	/*
	 * 목록에 보여줄 규칙.
	 *   - 검색어가 있으면 전체에서 검색
	 *   - 없으면 이 소설에서 한 줄이라도 잡히는 규칙, 내가 추가한 규칙,
	 *     지금 선택된 규칙만 보이고 나머지는 "안 맞는 규칙 N개 보기"로 접어 둔다.
	 */
	const keyword = episodeRuleSearch.trim().toLowerCase();

	const filteredRuleOptions = useMemo(() => {
		if (keyword) {
			return ruleOptions.filter(
				(option) =>
					option.label
						.toLowerCase()
						.includes(keyword) ||
					(option.hint ?? "")
						.toLowerCase()
						.includes(keyword)
			);
		}

		if (showAllRules || !ruleStats) {
			return ruleOptions;
		}

		return ruleOptions.filter(
			(option) =>
				option.kind === "custom" ||
				selectedRuleKeys.includes(option.key) ||
				pendingRuleKeys.includes(option.key) ||
				(ruleStats[option.key]?.count ?? 0) > 0
		);
	}, [
		ruleOptions,
		keyword,
		showAllRules,
		ruleStats,
		selectedRuleKeys,
		pendingRuleKeys,
	]);

	const hiddenRuleCount = keyword
		? 0
		: ruleOptions.length - filteredRuleOptions.length;

	const setRuleSelection = useCallback(
		(selection: RuleSelection) => {
			setSelectedRuleKeys(selection.keys);
			setPendingRuleKeys(selection.keys);
			setRuleSource(selection.source);
		},
		[]
	);

	/* 목록에서 규칙을 켜고 끈다. 최소 하나는 켜져 있어야 한다. */
	const togglePendingRuleKey = useCallback(
		(key: string) => {
			setPendingRuleKeys((previous) => {
				if (previous.includes(key)) {
					return previous.length > 1
						? previous.filter((item) => item !== key)
						: previous;
				}

				return [...previous, key];
			});
		},
		[]
	);

	/* 선택한 규칙들로 다시 나누고, 보고 있던 회차 위치는 최대한 유지한다. */
	const reparseWithOptions = useCallback(
		(options: RuleOption[]) => {
			if (!fileContent) {
				return;
			}

			const nextParsed = parseNovel(
				fileContent,
				options
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
		async (ruleKeys: string[]) => {
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
						ruleKey: serializeRuleKeys(ruleKeys),
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

	/* 목록에서 고른 규칙들을 "확인"으로 적용한다. */
	const confirmRuleSelection = useCallback(
		async (): Promise<boolean> => {
			const options = pendingRuleKeys
				.map((key) => findRuleOption(ruleOptions, key))
				.filter(
					(option): option is RuleOption => !!option
				);

			if (options.length === 0) {
				return false;
			}

			const keys = options.map((option) => option.key);

			const unchanged =
				keys.length === selectedRuleKeys.length &&
				keys.every((key) =>
					selectedRuleKeys.includes(key)
				);

			if (unchanged && ruleSource === "manual") {
				return true;
			}

			setEpisodeRuleSaving(true);
			setEpisodeRuleError("");

			try {
				await persistRuleChoice(keys);

				reparseWithOptions(options);

				setSelectedRuleKeys(keys);
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
			pendingRuleKeys,
			selectedRuleKeys,
			ruleSource,
			persistRuleChoice,
			reparseWithOptions,
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
	 * 규칙 추가: 목록에 넣고, 지금 선택된 규칙들에 더해 바로 적용한다.
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

				const nextOptions = buildRuleOptions(nextRules);

				const option =
					nextOptions.find(
						(item) =>
							item.ruleId !== undefined &&
							item.ruleId === addedRule.id
					) ??
					findRuleOption(
						nextOptions,
						customRuleKey(addedRule.rule)
					);

				if (option) {
					const matched = fileContent
						? parseNovel(fileContent, option)
								.episodes.length
						: 0;

					if (matched === 0) {
						setEpisodeRuleError(
							"규칙은 추가했지만, 이 소설에서는 맞는 회차를 찾지 못해 적용하지 않았습니다."
						);
					} else {
						const nextKeys = Array.from(
							new Set([
								...selectedRuleKeys,
								option.key,
							])
						);

						const nextSelected = nextKeys
							.map((key) =>
								findRuleOption(nextOptions, key)
							)
							.filter(
								(item): item is RuleOption => !!item
							);

						await persistRuleChoice(nextKeys);

						reparseWithOptions(nextSelected);

						setSelectedRuleKeys(nextKeys);
						setPendingRuleKeys(nextKeys);
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
		selectedRuleKeys,
		persistRuleChoice,
		reparseWithOptions,
	]);

	/*
	 * 규칙 삭제. 지금 이 소설에 적용 중인 규칙을 지우면
	 * 남은 선택으로 다시 나누고, 남은 게 없으면 자동 감지로 고른다.
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

				const removedKey = customRuleOptionKey(
					removed.id ?? `text:${removed.rule}`
				);

				setPendingRuleKeys((previous) => {
					const next = previous.filter(
						(key) => key !== removedKey
					);

					return next.length > 0
						? next
						: selectedRuleKeys.filter(
								(key) => key !== removedKey
							);
				});

				if (!selectedRuleKeys.includes(removedKey)) {
					return;
				}

				const nextOptions = buildRuleOptions(nextRules);

				const remainingKeys = selectedRuleKeys.filter(
					(key) => key !== removedKey
				);

				if (remainingKeys.length > 0) {
					reparseWithOptions(
						remainingKeys
							.map((key) =>
								findRuleOption(nextOptions, key)
							)
							.filter(
								(item): item is RuleOption => !!item
							)
					);

					setSelectedRuleKeys(remainingKeys);
					setPendingRuleKeys(remainingKeys);

					return;
				}

				const recommended = fileContent
					? detectBestRule(fileContent, nextOptions)
							.recommendedKey
					: null;

				const nextKey =
					recommended ?? DEFAULT_RULE_KEY;

				const nextOption = findRuleOption(
					nextOptions,
					nextKey
				);

				if (nextOption) {
					reparseWithOptions([nextOption]);
				}

				setSelectedRuleKeys([nextKey]);
				setPendingRuleKeys([nextKey]);
				setRuleSource(
					recommended ? "auto" : "default"
				);
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
			selectedRuleKeys,
			reparseWithOptions,
		]
	);

	/*
	 * 규칙 수정.
	 *   - 내가 추가한 규칙: 그 규칙의 글자를 바꾼다.
	 *   - 기본 규칙: 고친 내용을 "대체 규칙"으로 저장하고, 목록에는 고친 글자로 보인다.
	 * 모든 소설에 공통으로 바뀌고, 지금 이 소설에 적용 중이면 바로 다시 나눈다.
	 */
	const saveRuleEdit = useCallback(
		async (
			option: RuleOption,
			text: string
		): Promise<boolean> => {
			const rule = text.trim();

			if (!rule.includes("xxx")) {
				setEpisodeRuleError(
					"규칙에는 xxx가 포함되어야 합니다."
				);
				return false;
			}

			setEpisodeRuleSaving(true);
			setEpisodeRuleError("");

			try {
				let nextRules: EpisodeRule[];

				if (option.kind === "custom" && option.ruleId) {
					const response = await fetch(
						"/api/episode-rules",
						{
							method: "PUT",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								id: option.ruleId,
								rule,
							}),
						}
					);

					const data = await response.json();

					if (!response.ok) {
						throw new Error(
							extractErrorMessage(
								data,
								"회차 규칙을 수정하지 못했습니다."
							)
						);
					}

					const updated = data.data as EpisodeRule;

					nextRules = episodeRules.map((item) =>
						item.id === option.ruleId
							? { ...item, rule: updated.rule }
							: item
					);
				} else {
					const encoded = encodeRuleOverride(
						option.key,
						rule
					);

					const existing = episodeRules.find(
						(item) =>
							parseRuleOverride(item.rule)
								?.baseKey === option.key
					);

					const response = await fetch(
						"/api/episode-rules",
						{
							method: existing?.id ? "PUT" : "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify(
								existing?.id
									? { id: existing.id, rule: encoded }
									: { rule: encoded }
							),
						}
					);

					const data = await response.json();

					if (!response.ok) {
						throw new Error(
							extractErrorMessage(
								data,
								"회차 규칙을 수정하지 못했습니다."
							)
						);
					}

					const saved = data.data as EpisodeRule;

					nextRules = existing
						? episodeRules.map((item) =>
								item.id === existing.id
									? { ...item, rule: saved.rule }
									: item
							)
						: [...episodeRules, saved];
				}

				setEpisodeRules(nextRules);

				if (selectedRuleKeys.includes(option.key)) {
					const nextOptions = buildRuleOptions(nextRules);

					reparseWithOptions(
						selectedRuleKeys
							.map((key) =>
								findRuleOption(nextOptions, key)
							)
							.filter(
								(item): item is RuleOption => !!item
							)
					);
				}

				return true;
			} catch (error) {
				console.error("회차 규칙 수정 실패:", error);

				setEpisodeRuleError(
					error instanceof Error
						? error.message
						: "회차 규칙을 수정하지 못했습니다."
				);

				return false;
			} finally {
				setEpisodeRuleSaving(false);
			}
		},
		[
			episodeRules,
			selectedRuleKeys,
			reparseWithOptions,
		]
	);

	/* 고쳐 쓰던 기본 규칙을 원래대로 되돌린다. */
	const resetRuleEdit = useCallback(
		async (option: RuleOption): Promise<boolean> => {
			const existing = episodeRules.find(
				(item) =>
					parseRuleOverride(item.rule)?.baseKey ===
					option.key
			);

			if (!existing?.id) {
				return true;
			}

			setEpisodeRuleSaving(true);
			setEpisodeRuleError("");

			try {
				const response = await fetch(
					"/api/episode-rules",
					{
						method: "DELETE",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ id: existing.id }),
					}
				);

				const data = await response.json();

				if (!response.ok) {
					throw new Error(
						extractErrorMessage(
							data,
							"원래 규칙으로 되돌리지 못했습니다."
						)
					);
				}

				const nextRules = episodeRules.filter(
					(item) => item.id !== existing.id
				);

				setEpisodeRules(nextRules);

				if (selectedRuleKeys.includes(option.key)) {
					const nextOptions = buildRuleOptions(nextRules);

					reparseWithOptions(
						selectedRuleKeys
							.map((key) =>
								findRuleOption(nextOptions, key)
							)
							.filter(
								(item): item is RuleOption => !!item
							)
					);
				}

				return true;
			} catch (error) {
				console.error("규칙 되돌리기 실패:", error);

				setEpisodeRuleError(
					error instanceof Error
						? error.message
						: "원래 규칙으로 되돌리지 못했습니다."
				);

				return false;
			} finally {
				setEpisodeRuleSaving(false);
			}
		},
		[
			episodeRules,
			selectedRuleKeys,
			reparseWithOptions,
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
		hiddenRuleCount,
		showAllRules,
		setShowAllRules,
		selectedRuleKeys,
		selectedRuleOptions,
		pendingRuleKeys,
		setPendingRuleKeys,
		togglePendingRuleKey,
		ruleSource,
		ruleStats,
		recommendedRuleKey,
		setRuleSelection,
		confirmRuleSelection,

		loadEpisodeRules,
		addEpisodeRule,
		deleteEpisodeRule,
		saveRuleEdit,
		resetRuleEdit,
	};
}
