"use client";

import {
	useEffect,
} from "react";

import type {
	EpisodeRule,
	ParsedNovel,
} from "@/lib/parser";

type DriveItem = {
	id: string;
	name: string;
	mimeType: string;
	modifiedTime?: string;
	size?: string;
};

type UseFileOpenParams = {
	fileId: string | null;
	targetEpisode: number | null;
	highlightId: string | null;

	loadNovelFile: (
		fileId: string
	) => Promise<{
		file: DriveItem;
		content: string;
		parsedNovel: ParsedNovel;
		episodeRules: EpisodeRule[];
	}>;

	setLoading: (
		loading: boolean
	) => void;

	setError: (
		error: string
	) => void;

	setSelectedFile: (
		file: DriveItem | null
	) => void;

	setFileContent: (
		content: string
	) => void;

	setParsedNovel: (
		novel: ParsedNovel | null
	) => void;

	setSelectedEpisodeIndex: (
		index: number
	) => void;

	setEpisodeRules: (
		rules: EpisodeRule[]
	) => void;

	initializeReadingState: (
		fileId: string,
		fileName: string,
		totalEpisodes: number
	) => Promise<{
		progress: {
			episode: number;
			scroll_position?: number | null;
		};
		round: {
			id: string;
			status: string;
		};
	} | null>;

	getBookmarkStatus: (
		fileId: string,
		episode: number
	) => Promise<unknown>;

	saveProgress: (
		episodeIndex: number,
		scrollPosition: number,
		roundId?: string,
		context?: {
			file: DriveItem;
			novel: ParsedNovel;
		}
	) => Promise<unknown>;

	restoreScrollPositionRef: {
		current: number;
	};

	skipScrollRestoreRef: {
		current: boolean;
	};
};

export function useFileOpen({
	fileId,
	targetEpisode,
	highlightId,
	loadNovelFile,
	setLoading,
	setError,
	setSelectedFile,
	setFileContent,
	setParsedNovel,
	setSelectedEpisodeIndex,
	setEpisodeRules,
	initializeReadingState,
	getBookmarkStatus,
	saveProgress,
	restoreScrollPositionRef,
	skipScrollRestoreRef,
}: UseFileOpenParams) {
	useEffect(() => {
		if (!fileId) {
			setLoading(false);

			setError(
				"파일을 찾을 수 없습니다."
			);

			return;
		}

		let cancelled = false;

		async function openFile() {
			setLoading(true);
			setError("");

			try {
				const result =
					await loadNovelFile(
						fileId!
					);

				if (cancelled) {
					return;
				}

				const {
					file: item,
					content,
					parsedNovel: parsed,
					episodeRules:
						loadedEpisodeRules,
				} = result;

				setEpisodeRules(
					loadedEpisodeRules
				);

				console.log(
					"PARSED NOVEL:",
					parsed
				);

				setSelectedFile(
					item
				);

				setFileContent(
					content
				);

				setParsedNovel(
					parsed
				);

				const readingState =
					await initializeReadingState(
						fileId!,
						item.name,
						parsed.episodes.length
					);

				if (!readingState) {
					throw new Error(
						"읽기 정보를 불러오지 못했습니다."
					);
				}

				if (cancelled) {
					return;
				}

				const savedProgress =
					readingState.progress;

				let initialEpisodeIndex =
					0;

				restoreScrollPositionRef.current =
					0;

				if (highlightId) {
					skipScrollRestoreRef.current =
						true;
				}

				if (
					targetEpisode !== null &&
					Number.isFinite(
						targetEpisode
					)
				) {
					const targetIndex =
						parsed.episodes.findIndex(
							(episode) =>
								episode.episode ===
								targetEpisode
						);

					if (
						targetIndex >= 0
					) {
						initialEpisodeIndex =
							targetIndex;

						if (
							savedProgress.episode ===
								targetEpisode &&
							!highlightId &&
							typeof savedProgress.scroll_position ===
								"number"
						) {
							restoreScrollPositionRef.current =
								Math.max(
									0,
									savedProgress.scroll_position
								);
						}
					}
				} else {
					const savedIndex =
						parsed.episodes.findIndex(
							(episode) =>
								episode.episode ===
								savedProgress.episode
						);

					if (
						savedIndex >= 0
					) {
						initialEpisodeIndex =
							savedIndex;
					} else if (
						savedProgress.episode >
						0
					) {
						initialEpisodeIndex =
							Math.max(
								0,
								Math.min(
									savedProgress.episode -
										1,
									parsed.episodes
										.length -
										1
								)
							);
					}

					if (
						!highlightId &&
						typeof savedProgress.scroll_position ===
							"number"
					) {
						restoreScrollPositionRef.current =
							Math.max(
								0,
								savedProgress.scroll_position
							);
					}
				}

				setSelectedEpisodeIndex(
					initialEpisodeIndex
				);

				const initialEpisode =
					parsed.episodes[
						initialEpisodeIndex
					];

				if (initialEpisode) {
					void getBookmarkStatus(
						fileId!,
						initialEpisode.episode
					);
				}

				if (
					readingState.round.status ===
						"reading" &&
					savedProgress.episode ===
						0 &&
					parsed.episodes.length >
						0 &&
					targetEpisode ===
						null
				) {
					restoreScrollPositionRef.current =
						0;

					void saveProgress(
						initialEpisodeIndex,
						0,
						readingState.round.id,
						{
							file: item,
							novel: parsed,
						}
					);
				}

				setLoading(false);
			} catch (error) {
				if (cancelled) {
					return;
				}

				console.error(
					"소설 열기 실패:",
					error
				);

				setError(
					error instanceof Error
						? error.message
						: "소설을 가져오지 못했습니다."
				);

				setLoading(false);
			}
		}

		void openFile();

		return () => {
			cancelled = true;
		};
	}, [
		fileId,
		targetEpisode,
		highlightId,
		loadNovelFile,
		setLoading,
		setError,
		setSelectedFile,
		setFileContent,
		setParsedNovel,
		setSelectedEpisodeIndex,
		setEpisodeRules,
		initializeReadingState,
		getBookmarkStatus,
		saveProgress,
		restoreScrollPositionRef,
		skipScrollRestoreRef,
	]);
}