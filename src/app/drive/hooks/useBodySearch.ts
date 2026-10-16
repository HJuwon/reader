"use client";

import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type BodySearchScope = "episode" | "all";

export type SearchableEpisode = {
	episode: number;
	title: string;
	content: string;
};

export type AllSearchResult = {
	episodeIndex: number;
	episode: number;
	title: string;
	count: number;
	before: string;
	match: string;
	after: string;
	hasMoreBefore: boolean;
	hasMoreAfter: boolean;
};

/** 전체 검색은 너무 짧은 검색어면 결과가 쏟아지므로 최소 글자 수를 둔다. */
export const GLOBAL_SEARCH_MIN_LENGTH = 2;

/** useMemo 의존성이 매 렌더마다 바뀌지 않도록 쓰는 빈 배열 */
export const EMPTY_SEARCH_EPISODES: SearchableEpisode[] = [];

const SNIPPET_BEFORE = 24;
const SNIPPET_AFTER = 48;
const JUMP_EXPIRE_MS = 5000;

type UseBodySearchParams = {
	contentRef: React.RefObject<HTMLDivElement | null>;
	selectedEpisodeContent?: string;
	selectedEpisodeIndex: number;
	episodes?: SearchableEpisode[];
};

export function useBodySearch({
	contentRef,
	selectedEpisodeContent,
	selectedEpisodeIndex,
	episodes = EMPTY_SEARCH_EPISODES,
}: UseBodySearchParams) {
	const [bodySearch, setBodySearch] = useState("");
	const [bodySearchOpen, setBodySearchOpenState] = useState(false);
	const [bodySearchIndex, setBodySearchIndex] = useState(0);
	const [bodySearchScope, setBodySearchScope] =
		useState<BodySearchScope>("episode");

	/*
	 * 검색창을 닫으면 범위를 기본값(이 화)으로 되돌린다.
	 */
	const setBodySearchOpen = useCallback((open: boolean) => {
		setBodySearchOpenState(open);

		if (!open) {
			setBodySearchScope("episode");
		}
	}, []);

	/*
	 * 현재 화 안에서의 검색 (기존 동작)
	 */
	const bodySearchMatches = useMemo(() => {
		if (!selectedEpisodeContent || !bodySearch.trim()) {
			return [];
		}

		const keyword = bodySearch.trim().toLowerCase();
		const lowerContent = selectedEpisodeContent.toLowerCase();
		const matches: number[] = [];

		let start = 0;

		while (true) {
			const index = lowerContent.indexOf(keyword, start);

			if (index === -1) {
				break;
			}

			matches.push(index);
			start = index + keyword.length;
		}

		return matches;
	}, [selectedEpisodeContent, bodySearch]);

	useEffect(() => {
		setBodySearchIndex(0);
	}, [bodySearch, selectedEpisodeIndex]);

	/*
	 * 전체 회차 검색
	 * - 입력할 때마다 모든 회차를 훑기 때문에 deferred 값으로 계산해서
	 *   타이핑이 끊기지 않게 한다.
	 */
	const deferredSearch = useDeferredValue(bodySearch);
	const allSearchKeyword = deferredSearch.trim();

	const allSearchPending =
		bodySearch.trim() !== allSearchKeyword;

	const allSearchResults = useMemo<AllSearchResult[]>(() => {
		if (
			bodySearchScope !== "all" ||
			allSearchKeyword.length < GLOBAL_SEARCH_MIN_LENGTH
		) {
			return [];
		}

		const keyword = allSearchKeyword.toLowerCase();
		const results: AllSearchResult[] = [];

		episodes.forEach((episode, episodeIndex) => {
			const content = episode.content;
			const lower = content.toLowerCase();

			const first = lower.indexOf(keyword);

			if (first === -1) {
				return;
			}

			let count = 0;
			let position = first;

			while (position !== -1) {
				count += 1;
				position = lower.indexOf(keyword, position + keyword.length);
			}

			const beforeStart = Math.max(0, first - SNIPPET_BEFORE);
			const matchEnd = first + keyword.length;
			const afterEnd = Math.min(content.length, matchEnd + SNIPPET_AFTER);

			results.push({
				episodeIndex,
				episode: episode.episode,
				title: episode.title,
				count,
				before: content
					.slice(beforeStart, first)
					.replace(/\s+/g, " "),
				match: content.slice(first, matchEnd),
				after: content
					.slice(matchEnd, afterEnd)
					.replace(/\s+/g, " "),
				hasMoreBefore: beforeStart > 0,
				hasMoreAfter: afterEnd < content.length,
			});
		});

		return results;
	}, [episodes, allSearchKeyword, bodySearchScope]);

	const allSearchTotalCount = useMemo(
		() =>
			allSearchResults.reduce(
				(sum, result) => sum + result.count,
				0
			),
		[allSearchResults]
	);

	/*
	 * 본문 안에서 n번째 검색 결과 위치로 스크롤
	 */
	const scrollToBodySearchMatchAt = useCallback(
		(matchIndex: number) => {
			if (
				!contentRef.current ||
				!selectedEpisodeContent ||
				!bodySearch.trim() ||
				bodySearchMatches.length === 0
			) {
				return;
			}

			const targetOffset = bodySearchMatches[matchIndex];

			if (targetOffset === undefined) {
				return;
			}

			const keywordLength = bodySearch.trim().length;

			const walker = document.createTreeWalker(
				contentRef.current,
				NodeFilter.SHOW_TEXT
			);

			let currentOffset = 0;

			while (walker.nextNode()) {
				const node = walker.currentNode as Text;
				const nodeText = node.textContent || "";
				const nodeStart = currentOffset;
				const nodeEnd = currentOffset + nodeText.length;

				if (targetOffset >= nodeStart && targetOffset < nodeEnd) {
					const range = document.createRange();

					range.setStart(node, targetOffset - nodeStart);

					range.setEnd(
						node,
						Math.min(
							targetOffset - nodeStart + keywordLength,
							nodeText.length
						)
					);

					const rect = range.getBoundingClientRect();

					const targetTop =
						window.scrollY + rect.top - window.innerHeight / 2;

					window.scrollTo({
						top: Math.max(0, targetTop),
						behavior: "smooth",
					});

					return;
				}

				currentOffset = nodeEnd;
			}
		},
		[
			contentRef,
			selectedEpisodeContent,
			bodySearch,
			bodySearchMatches,
		]
	);

	/*
	 * 이전 / 다음 검색 결과
	 */
	const scrollToBodySearchMatch = useCallback(
		(direction: 1 | -1) => {
			if (bodySearchMatches.length === 0) {
				return;
			}

			const nextIndex =
				direction === 1
					? (bodySearchIndex + 1) % bodySearchMatches.length
					: (bodySearchIndex - 1 + bodySearchMatches.length) %
						bodySearchMatches.length;

			setBodySearchIndex(nextIndex);
			scrollToBodySearchMatchAt(nextIndex);
		},
		[
			bodySearchIndex,
			bodySearchMatches,
			scrollToBodySearchMatchAt,
		]
	);

	/*
	 * 전체 검색 결과를 눌러서 다른 화로 이동한 뒤,
	 * 그 화가 화면에 그려지고 나면 첫 번째 검색 결과로 스크롤한다.
	 */
	const pendingJumpRef = useRef<{
		episodeIndex: number;
		expiresAt: number;
	} | null>(null);

	const prepareBodySearchJump = useCallback(
		(episodeIndex: number) => {
			pendingJumpRef.current = {
				episodeIndex,
				expiresAt: Date.now() + JUMP_EXPIRE_MS,
			};
		},
		[]
	);

	useEffect(() => {
		const pending = pendingJumpRef.current;

		if (!pending) {
			return;
		}

		if (Date.now() > pending.expiresAt) {
			pendingJumpRef.current = null;
			return;
		}

		if (
			pending.episodeIndex !== selectedEpisodeIndex ||
			!bodySearch.trim() ||
			bodySearchMatches.length === 0
		) {
			return;
		}

		pendingJumpRef.current = null;

		// 회차 전환 직후의 스크롤 복원 등이 끝난 뒤에 이동한다.
		window.setTimeout(() => {
			scrollToBodySearchMatchAt(0);
		}, 150);
	}, [
		selectedEpisodeIndex,
		bodySearch,
		bodySearchMatches,
		scrollToBodySearchMatchAt,
	]);

	return {
		bodySearch,
		setBodySearch,

		bodySearchOpen,
		setBodySearchOpen,

		bodySearchIndex,
		setBodySearchIndex,
		bodySearchMatches,
		scrollToBodySearchMatch,
		scrollToBodySearchMatchAt,

		bodySearchScope,
		setBodySearchScope,
		allSearchResults,
		allSearchTotalCount,
		allSearchPending,
		prepareBodySearchJump,
	};
}
