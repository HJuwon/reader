"use client";

import {
	useMemo,
	type ReactNode,
} from "react";

type Highlight = {
	id: string | number;
	start_offset?: number | null;
	end_offset?: number | null;
};

type UseHighlightRendererParams = {
	content: string;
	highlights: Highlight[];
};

export function useHighlightRenderer({
	content,
	highlights,
}: UseHighlightRendererParams) {
	const highlightedContent = useMemo(() => {
		if (highlights.length === 0) {
			return content;
		}

		const validHighlights =
			highlights
				.filter(
					(highlight) =>
						typeof highlight.start_offset ===
							"number" &&
						typeof highlight.end_offset ===
							"number" &&
						highlight.end_offset >
							highlight.start_offset
				)
				.map((highlight) => ({
					...highlight,
					start_offset:
						highlight.start_offset as number,
					end_offset:
						highlight.end_offset as number,
				}))
				.filter(
					(highlight) =>
						highlight.start_offset >= 0 &&
						highlight.end_offset <=
							content.length
				)
				.sort(
					(a, b) =>
						a.start_offset -
						b.start_offset
				);

		if (validHighlights.length === 0) {
			return content;
		}

		const parts: ReactNode[] = [];

		let currentPosition = 0;

		validHighlights.forEach(
			(highlight, index) => {
				const start =
					highlight.start_offset;

				const end =
					highlight.end_offset;

				if (
					start >
					currentPosition
				) {
					parts.push(
						<span
							key={`text-${index}`}
						>
							{content.slice(
								currentPosition,
								start
							)}
						</span>
					);
				}

				if (
					end >
					currentPosition
				) {
					const actualStart =
						Math.max(
							start,
							currentPosition
						);

					parts.push(
						<span
							key={`highlight-${highlight.id}`}
							data-highlight-id={
								highlight.id
							}
							style={{
								backgroundColor:
									"rgba(255, 225, 120, 0.5)",
								borderRadius:
									"2px",
							}}
						>
							{content.slice(
								actualStart,
								end
							)}
						</span>
					);

					currentPosition =
						end;
				}
			}
		);

		if (
			currentPosition <
			content.length
		) {
			parts.push(
				<span key="text-last">
					{content.slice(
						currentPosition
					)}
				</span>
			);
		}

		return parts;
	}, [content, highlights]);

	return {
		highlightedContent,
	};
}