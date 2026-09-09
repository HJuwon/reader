"use client";

import {
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { Episode } from "@/lib/parser/types";

type UseEpisodeListParams = {
	episodes: Episode[];
	selectedEpisodeIndex: number;
};

export function useEpisodeList({
	episodes,
	selectedEpisodeIndex,
}: UseEpisodeListParams) {
	const [episodeSearch, setEpisodeSearch] =
		useState("");

	const [episodeListOpen, setEpisodeListOpen] =
		useState(false);

	const mobileEpisodeListRef =
		useRef<HTMLDivElement | null>(null);

	const filteredEpisodes = useMemo(() => {
		const keyword =
			episodeSearch.trim().toLowerCase();

		if (!keyword) {
			return episodes;
		}

		return episodes.filter(
			(episode) =>
				String(episode.episode)
					.toLowerCase()
					.includes(keyword) ||
				episode.title
					.toLowerCase()
					.includes(keyword)
		);
	}, [
		episodes,
		episodeSearch,
	]);

	useEffect(() => {
		if (
			!episodeListOpen ||
			!mobileEpisodeListRef.current
		) {
			return;
		}

		const selectedButton =
			mobileEpisodeListRef.current.querySelector(
				`[data-episode-index="${selectedEpisodeIndex}"]`
			) as HTMLElement | null;

		if (!selectedButton) {
			return;
		}

		window.setTimeout(() => {
			selectedButton.scrollIntoView({
				block: "nearest",
				behavior: "auto",
			});
		}, 0);
	}, [
		episodeListOpen,
		selectedEpisodeIndex,
		episodeSearch,
		filteredEpisodes.length,
		episodes,
	]);

	return {
		episodeSearch,
		setEpisodeSearch,

		episodeListOpen,
		setEpisodeListOpen,

		filteredEpisodes,

		mobileEpisodeListRef,
	};
}