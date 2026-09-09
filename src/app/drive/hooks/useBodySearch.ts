"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

type UseBodySearchParams = {
	contentRef: React.RefObject<HTMLDivElement | null>;
	selectedEpisodeContent?: string;
	selectedEpisodeIndex: number;
};

export function useBodySearch({
	contentRef,
	selectedEpisodeContent,
	selectedEpisodeIndex,
}: UseBodySearchParams) {
	const [bodySearch, setBodySearch] =
		useState("");

	const [bodySearchIndex, setBodySearchIndex] =
		useState(0);

	const bodySearchMatches =
		useMemo(() => {
			if (
				!selectedEpisodeContent ||
				!bodySearch.trim()
			) {
				return [];
			}

			const content =
				selectedEpisodeContent;

			const keyword =
				bodySearch.trim().toLowerCase();

			const lowerContent =
				content.toLowerCase();

			const matches: number[] = [];

			let start = 0;

			while (true) {
				const index =
					lowerContent.indexOf(
						keyword,
						start
					);

				if (index === -1) {
					break;
				}

				matches.push(index);

				start =
					index + keyword.length;
			}

			return matches;
		}, [
			selectedEpisodeContent,
			bodySearch,
		]);

	useEffect(() => {
		setBodySearchIndex(0);
	}, [
		bodySearch,
		selectedEpisodeIndex,
	]);

	const scrollToBodySearchMatch =
		useCallback(
			(direction: 1 | -1) => {
				if (
					!contentRef.current ||
					!selectedEpisodeContent ||
					!bodySearch.trim()
				) {
					return;
				}

				if (
					bodySearchMatches.length ===
					0
				) {
					return;
				}

				let nextIndex =
					bodySearchIndex;

				if (direction === 1) {
					nextIndex =
						(bodySearchIndex + 1) %
						bodySearchMatches.length;
				} else {
					nextIndex =
						(bodySearchIndex -
							1 +
							bodySearchMatches.length) %
						bodySearchMatches.length;
				}

				setBodySearchIndex(
					nextIndex
				);

				const targetOffset =
					bodySearchMatches[
						nextIndex
					];

				const keywordLength =
					bodySearch.trim().length;

				const walker =
					document.createTreeWalker(
						contentRef.current,
						NodeFilter.SHOW_TEXT
					);

				let currentOffset = 0;

				while (walker.nextNode()) {
					const node =
						walker.currentNode as Text;

					const nodeText =
						node.textContent || "";

					const nodeStart =
						currentOffset;

					const nodeEnd =
						currentOffset +
						nodeText.length;

					if (
						targetOffset >=
							nodeStart &&
						targetOffset <
							nodeEnd
					) {
						const range =
							document.createRange();

						range.setStart(
							node,
							targetOffset -
								nodeStart
						);

						range.setEnd(
							node,
							Math.min(
								targetOffset -
									nodeStart +
									keywordLength,
								nodeText.length
							)
						);

						const rect =
							range.getBoundingClientRect();

						const targetTop =
							window.scrollY +
							rect.top -
							window.innerHeight /
								2;

						window.scrollTo({
							top: Math.max(
								0,
								targetTop
							),
							behavior:
								"smooth",
						});

						return;
					}

					currentOffset =
						nodeEnd;
				}
			},
			[
				contentRef,
				selectedEpisodeContent,
				bodySearch,
				bodySearchIndex,
				bodySearchMatches,
			]
		);

	return {
		bodySearch,
		setBodySearch,
		bodySearchIndex,
		setBodySearchIndex,
		bodySearchMatches,
		scrollToBodySearchMatch,
	};
}