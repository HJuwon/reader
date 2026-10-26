"use client";

import { useNovelLoader } from "./hooks/useNovelLoader";

import {
	useHighlights,
} from "./hooks/useHighlights";

import { useHighlightSelection } from "./hooks/useHighlightSelection";

import { useBookmark } from "./hooks/useBookmark";

import type {
	EpisodeRule,
	ParsedNovel,
} from "@/lib/parser";
import { inspectParsing, type InspectResult } from "@/lib/parser";

import {
	useRef,
	useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { useReadingProgress } from "./hooks/useReadingProgress";
import { useEpisodeRules } from "./hooks/useEpisodeRules";
import {
	useBodySearch,
	EMPTY_SEARCH_EPISODES,
	GLOBAL_SEARCH_MIN_LENGTH,
} from "./hooks/useBodySearch";
import { useContentEditor } from "./hooks/useContentEditor";
import { useMarathonScroll } from "./hooks/useMarathonScroll";
import ReaderSettingsPanel from "./components/ReaderSettingsPanel";
import { useEpisodeNavigation } from "./hooks/useEpisodeNavigation";
import { useFileClose } from "./hooks/useFileClose";
import { useReaderChrome } from "./hooks/useReaderChrome";
import { useEpisodeList } from "./hooks/useEpisodeList";
import { useEpisodePanel } from "./hooks/useEpisodePanel";
import { useFileOpen } from "./hooks/useFileOpen";
import { useHighlightRenderer } from "./hooks/useHighlightRenderer";

import {
	useReaderSettings,
} from "./hooks/useReaderSettings";

import {
	ArrowLeft,
	Bookmark,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	List,
	Loader2,
	Search,
	Settings,
	X,
} from "lucide-react";


type DriveItem = {
	id: string;
	name: string;
	mimeType: string;
	modifiedTime?: string;
	size?: string;
};


const SERIF =
	"'Noto Serif KR', 'Nanum Myeongjo', ui-serif, Georgia, serif";


export default function DriveBrowser() {
	const searchParams = useSearchParams();

	const {
		loadNovelFile,
	} = useNovelLoader();

	const highlightId =
		searchParams.get("highlightId");


	const [loading, setLoading] =
		useState(true);

	const [error, setError] =
		useState("");

	const [selectedFile, setSelectedFile] =
		useState<DriveItem | null>(null);

	const [fileContent, setFileContent] =
		useState("");

	const [parsedNovel, setParsedNovel] =
		useState<ParsedNovel | null>(null);

	/* 회차 점검 결과 */
	const [inspectResult, setInspectResult] =
		useState<InspectResult | null>(null);

	const [selectedEpisodeIndex, setSelectedEpisodeIndex] =
		useState(0);

	const contentRef =
		useRef<HTMLDivElement | null>(null);

	const selectedEpisode =
		parsedNovel?.episodes[
			selectedEpisodeIndex
		];


	const {
		themeKey,
		setThemeKey,
		fontSize,
		setFontSize,
		fontKey,
		setFontKey,
		fontFamily,
		lineHeight,
		setLineHeight,
		letterSpacing,
		setLetterSpacing,
		marathon,
		setMarathon,
		settingsOpen,
		setSettingsOpen,
		theme,
	} = useReaderSettings();


	const {
		chromeVisible,
		setChromeVisible,
		handleContentTap,
	} = useReaderChrome();


	const {
		episodeSearch,
		setEpisodeSearch,
		episodeListOpen,
		setEpisodeListOpen,
		filteredEpisodes,
		mobileEpisodeListRef,
	} = useEpisodeList({
		episodes:
			parsedNovel?.episodes ?? [],
		selectedEpisodeIndex,
	});

	/* 규칙 목록에서 수정 중인 규칙과 입력 중인 글자 */
	const [editingRuleKey, setEditingRuleKey] =
		useState<string | null>(null);

	const [editingRuleText, setEditingRuleText] =
		useState("");

	const {
		episodeRuleManagerOpen,
		setEpisodeRuleManagerOpen,
		episodeEditPanelOpen,
		setEpisodeEditPanelOpen,
	} = useEpisodePanel();


	/*
	 * 읽기 진행도
	 */
	const {
		bookId,
		roundId,
		roundStatus,
		progressSaving,
		initializeReadingState,
		saveProgress,
		saveScrollPosition,
		scrollPositionRef,
		restoreScrollPositionRef,
		skipScrollRestoreRef,
	} = useReadingProgress({
		selectedFile,
		parsedNovel,
		selectedEpisode,
		selectedEpisodeIndex,
	});


	/*
	 * 회차 규칙
	 */
	const {
		episodeRules,
		setEpisodeRules,
		episodeRuleInput,
		setEpisodeRuleInput,
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
		addEpisodeRule,
		deleteEpisodeRule,
		saveRuleEdit,
		resetRuleEdit,
	} = useEpisodeRules({
		fileId: searchParams.get("fileId"),
		fileContent,
		selectedEpisodeStartLine:
			selectedEpisode?.startLine,
		selectedEpisodeIndex,
		episodeRuleManagerOpen,
		setParsedNovel,
		setSelectedEpisodeIndex,
	});


	const {
		editingContent,
		editedText,
		editedTitle,
		savingEdit,
		editError,
		setEditedText,
		setEditedTitle,
		startEditingContent,
		cancelEditingContent,
		saveEditedContent,
	} = useContentEditor({
		fileContent,
		selectedFile,
		selectedEpisode,
		selectedRuleOptions,
		setFileContent,
		setParsedNovel,
	});


	/*
	 * 본문 검색
	 */
	const {
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
	} = useBodySearch({
		contentRef,
		selectedEpisodeContent:
			selectedEpisode?.content,
		selectedEpisodeIndex,
		episodes:
			parsedNovel?.episodes ?? EMPTY_SEARCH_EPISODES,
	});


	/*
	 * 북마크
	 */
	const {
		bookmarked,
		bookmarkLoading,
		getBookmarkStatus,
		toggleBookmark,
	} = useBookmark({
		bookId,
		fileId:
			selectedFile?.id ?? null,
		episode:
			selectedEpisode?.episode ?? null,
	});


	const {
		changeEpisode,
		goToPrevEpisode,
		goToNextEpisode,
	} = useEpisodeNavigation({
		parsedNovel,
		selectedEpisodeIndex,
		progressSaving,
		roundStatus,
		selectedFile,
		setSelectedEpisodeIndex,
		setEpisodeListOpen,
		setChromeVisible,
		setBodySearch,
		setBodySearchIndex,
		saveProgress,
		getBookmarkStatus,
		scrollPositionRef,
		restoreScrollPositionRef,
	});

	/* 정주행: 본문 끝에서 한 번 더 내리면 다음 화로 */
	const { progress: marathonProgress } =
		useMarathonScroll({
			enabled: marathon,
			hasNext: Boolean(
				parsedNovel &&
					selectedEpisodeIndex <
						parsedNovel.episodes.length - 1
			),
			disabled:
				editingContent ||
				episodeListOpen ||
				settingsOpen ||
				progressSaving,
			onNext: goToNextEpisode,
			resetKey: selectedEpisodeIndex,
		});


	/*
	 * 전체 검색 결과 클릭 → 해당 화로 이동 후 검색어 위치로 스크롤
	 * (changeEpisode 는 이동하면서 검색어를 비우기 때문에 다시 채워 넣는다)
	 */
	async function handleSearchResultClick(
		episodeIndex: number,
	) {
		const keyword = bodySearch;

		setBodySearchScope("episode");

		if (episodeIndex === selectedEpisodeIndex) {
			setBodySearchIndex(0);
			scrollToBodySearchMatchAt(0);
			return;
		}

		prepareBodySearchJump(episodeIndex);

		await changeEpisode(episodeIndex);

		setBodySearch(keyword);
	}


	const {
		closeFile,
	} = useFileClose({
		selectedFile,
		parsedNovel,
		selectedEpisode,
		roundId,
		roundStatus,
		saveScrollPosition,
	});


	/*
	 * 하이라이트
	 */
	const {
		highlights,
		highlightLoading,
		saveHighlight: saveHighlightApi,
	} = useHighlights({
		fileId:
			selectedFile?.id ?? null,
		episode:
			selectedEpisode?.episode ?? null,
	});


	const {
		selectedTextForHighlight,
		selectedHighlightRange,
		showHighlightButton,
		handleTextSelection,
		savePendingHighlight,
	} = useHighlightSelection({
		contentRef,
		selectedEpisodeIndex,
		selectedEpisode,
		highlights,
		highlightId,
		saveHighlightApi,
		bookId,
		fileId:
			selectedFile?.id ?? null,
		scrollPositionRef,
	});


	/*
	 * 하이라이트 렌더링
	 */
	const {
		highlightedContent,
	} = useHighlightRenderer({
		content:
			selectedEpisode?.content ?? "",
		highlights,
	});


	useFileOpen({
		fileId:
			searchParams.get("fileId"),

		targetEpisode:
			searchParams.get("episode")
				? Number(
						searchParams.get(
							"episode"
						)
					)
				: null,

		highlightId,

		loadNovelFile,

		setLoading,
		setError,
		setSelectedFile,
		setFileContent,
		setParsedNovel,
		setSelectedEpisodeIndex,
		setEpisodeRules,
		setRuleSelection,

		initializeReadingState,
		getBookmarkStatus,
		saveProgress,

		restoreScrollPositionRef,
		skipScrollRestoreRef,
	});


	/*
	 * 로딩
	 */
	if (loading) {
		return (
			<main
				className="flex min-h-screen items-center justify-center"
				style={{
					backgroundColor:
						theme.bg,
					color:
						theme.muted,
				}}
			>
				<div className="flex items-center gap-2 text-sm">
					<Loader2 className="h-5 w-5 animate-spin" />
					소설을 불러오는 중...
				</div>
			</main>
		);
	}


	/*
	 * 에러
	 */
	if (
		error ||
		!selectedFile
	) {
		return (
			<main
				className="flex min-h-screen items-center justify-center px-6"
				style={{
					backgroundColor:
						theme.bg,
					color:
						theme.text,
				}}
			>
				<div className="text-center">
					<p
						className="text-sm"
						style={{
							color:
								theme.title,
						}}
					>
						{error ||
							"파일을 찾을 수 없습니다."}
					</p>

					<button
						onClick={closeFile}
						className="mt-5 text-sm hover:opacity-70"
						style={{
							color:
								theme.muted,
						}}
					>
						돌아가기
					</button>
				</div>
			</main>
		);
	}


	const isFirstEpisode =
		selectedEpisodeIndex ===
		0;

	const isLastEpisode =
		parsedNovel
			? selectedEpisodeIndex ===
				parsedNovel.episodes.length -
					1
			: true;


	const topBarVisible =
		chromeVisible ||
		bodySearchOpen ||
		episodeListOpen;

	return (
		<main
			className="min-h-screen transition-colors"
			style={{
				backgroundColor:
					theme.bg,
				color:
					theme.title,
			}}
		>
			{/* 상단 바: 본문을 탭하면 하단바와 함께 나타나고 사라진다 */}
			<header
				className={`fixed inset-x-0 top-0 z-50 transition-[transform,opacity] duration-300 ease-out ${
					topBarVisible
						? "translate-y-0 opacity-100"
						: "pointer-events-none -translate-y-full opacity-0"
				}`}
				style={{
					backgroundColor: theme.bg,
					borderBottom: `0.5px solid ${theme.divider}`,
					paddingTop: "env(safe-area-inset-top, 0px)",
				}}
			>
				<div className="mx-auto flex max-w-5xl items-center gap-1 px-2 py-2 md:px-6">
					<button
						onClick={closeFile}
						aria-label="돌아가기"
						className="shrink-0 rounded-full p-2 transition hover:opacity-70"
						style={{ color: theme.muted }}
					>
						<ArrowLeft className="h-5 w-5" />
					</button>

					<div className="min-w-0 flex-1 px-1">
						<h1
							className="truncate text-sm font-medium"
							style={{ fontFamily: SERIF, color: theme.title }}
						>
							{selectedFile.name}
						</h1>

						<p
							className="mt-0.5 text-[11px] tabular-nums"
							style={{ color: theme.muted }}
						>
							{selectedEpisode
								? `${selectedEpisode.episode}화`
								: "-"}
							{" / "}
							{parsedNovel ? `${parsedNovel.totalEpisodes}화` : "-"}
							{progressSaving && " · 저장 중..."}
						</p>
					</div>

					<div className="flex shrink-0 items-center">
						<button
							onClick={() => {
								if (bodySearchOpen) {
									setBodySearch("");
									setBodySearchOpen(false);
								} else {
									setEpisodeListOpen(false);
									setBodySearchOpen(true);
									setBodySearchIndex(0);
								}
							}}
							disabled={!parsedNovel}
							aria-label="본문 검색"
							aria-pressed={bodySearchOpen}
							className="rounded-full p-2 transition hover:opacity-70 disabled:opacity-30"
							style={{
								color: bodySearchOpen ? theme.accent : theme.muted,
							}}
						>
							<Search className="h-5 w-5" />
						</button>

						<button
							onClick={toggleBookmark}
							disabled={bookmarkLoading || !selectedEpisode}
							aria-label={bookmarked ? "북마크 해제" : "북마크"}
							aria-pressed={bookmarked}
							className="rounded-full p-2 transition hover:opacity-70 disabled:opacity-30"
							style={{
								color: bookmarked ? theme.accent : theme.muted,
							}}
						>
							<Bookmark
								className="h-5 w-5"
								fill={bookmarked ? "currentColor" : "none"}
							/>
						</button>

						<button
							onClick={() => {
								if (!episodeListOpen && bodySearchOpen) {
									setBodySearch("");
									setBodySearchOpen(false);
								}
								setEpisodeListOpen((open) => !open);
							}}
							disabled={!parsedNovel}
							aria-label="회차 목록"
							aria-expanded={episodeListOpen}
							className="rounded-full p-2 transition hover:opacity-70 disabled:opacity-30"
							style={{
								color: episodeListOpen ? theme.accent : theme.muted,
							}}
						>
							<List className="h-5 w-5" />
						</button>
					</div>
				</div>

				{/* 본문 검색 */}
				{bodySearchOpen && (
					<div className="mx-auto max-w-5xl px-3 pb-3 md:px-6">
														<div
															className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-1.5"
															style={{
																boxShadow: `0 0 0 0.5px ${theme.divider}`,
															}}
														>
															<Search
																className="h-3.5 w-3.5 shrink-0"
																style={{
																	color:
																		theme.muted,
																}}
															/>

															<input
																autoFocus
																type="text"
																value={
																	bodySearch
																}
																onChange={(
																	e
																) =>
																	setBodySearch(
																		e
																			.target
																			.value
																	)
																}
																onKeyDown={(
																	e
																) => {
																	if (
																		e.key ===
																		"Enter"
																	) {
																		if (bodySearchScope === "all") {
																			if (allSearchResults[0]) {
																				handleSearchResultClick(
																					allSearchResults[0].episodeIndex,
																				);
																			}
																		} else {
																			scrollToBodySearchMatch(1);
																		}
																	}

																	if (
																		e.key ===
																		"Escape"
																	) {
																		setBodySearch(
																			""
																		);

																		setBodySearchOpen(
																			false
																		);
																	}
																}}
																placeholder={
																bodySearchScope === "all"
																	? "전체 회차에서 검색"
																	: "본문에서 검색"
															}
																className="min-w-0 flex-1 bg-transparent text-sm outline-none"
																style={{
																	color:
																		theme.title,
																}}
															/>

															<button
																onClick={() =>
																	setBodySearchScope(
																		bodySearchScope === "all"
																			? "episode"
																			: "all",
																	)
																}
																aria-label="검색 범위 전환"
																className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition hover:opacity-80"
																style={{
																	color:
																		bodySearchScope === "all"
																			? theme.accent
																			: theme.muted,
																	backgroundColor:
																		bodySearchScope === "all"
																			? `${theme.accent}22`
																			: theme.divider,
																}}
															>
																{bodySearchScope === "all"
																	? "전체"
																	: "이 화"}
															</button>

															{bodySearch.trim() && (
																<span
																	className="shrink-0 text-[11px] tabular-nums"
																	style={{
																		color:
																			theme.muted,
																	}}
																>
																	{bodySearchScope === "all"
																	? allSearchPending ||
																			bodySearch.trim().length <
																				GLOBAL_SEARCH_MIN_LENGTH
																		? ""
																		: `${allSearchResults.length}개 화`
																	: bodySearchMatches.length > 0
																		? `${bodySearchIndex + 1}/${bodySearchMatches.length}`
																		: "0/0"}
																</span>
															)}

															<button
																onClick={() =>
																	scrollToBodySearchMatch(
																		-1
																	)
																}
																disabled={
																	bodySearchMatches.length ===
																	0
																}
																className={`shrink-0 rounded-full p-1 disabled:opacity-30 ${
																	bodySearchScope === "all" ? "hidden" : ""
																}`}
																style={{
																	color:
																		theme.title,
																}}
																aria-label="이전 검색 결과"
															>
																<ChevronLeft className="h-4 w-4" />
															</button>

															<button
																onClick={() =>
																	scrollToBodySearchMatch(
																		1
																	)
																}
																disabled={
																	bodySearchMatches.length ===
																	0
																}
																className={`shrink-0 rounded-full p-1 disabled:opacity-30 ${
																	bodySearchScope === "all" ? "hidden" : ""
																}`}
																style={{
																	color:
																		theme.title,
																}}
																aria-label="다음 검색 결과"
															>
																<ChevronRight className="h-4 w-4" />
															</button>

															<button
																onClick={() => {
																	setBodySearch(
																		""
																	);

																	setBodySearchOpen(
																		false
																	);
																}}
																className="shrink-0 rounded-full p-1"
																style={{
																	color:
																		theme.muted,
																}}
																aria-label="본문 검색 닫기"
															>
																<X className="h-4 w-4" />
															</button>
														</div>
												{bodySearchOpen &&
												bodySearchScope === "all" &&
												bodySearch.trim() && (
													<div
														className="mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-lg"
														style={{
															boxShadow: `0 0 0 0.5px ${theme.divider}`,
														}}
													>
														{bodySearch.trim().length <
														GLOBAL_SEARCH_MIN_LENGTH ? (
															<p
																className="px-3 py-3 text-xs"
																style={{ color: theme.muted }}
															>
																{GLOBAL_SEARCH_MIN_LENGTH}글자 이상
																입력해 주세요.
															</p>
														) : allSearchPending ? (
															<p
																className="px-3 py-3 text-xs"
																style={{ color: theme.muted }}
															>
																검색 중…
															</p>
														) : allSearchResults.length === 0 ? (
															<p
																className="px-3 py-3 text-xs"
																style={{ color: theme.muted }}
															>
																검색 결과가 없습니다.
															</p>
														) : (
															<>
																<p
																	className="px-3 pt-2.5 pb-1 text-[11px]"
																	style={{ color: theme.muted }}
																>
																	{allSearchResults.length}개 화에서
																	총 {allSearchTotalCount}건
																</p>

																{allSearchResults.map((result) => (
																	<button
																		key={result.episodeIndex}
																		onClick={() =>
																			handleSearchResultClick(
																				result.episodeIndex,
																			)
																		}
																		className="block w-full px-3 py-2.5 text-left transition hover:opacity-80"
																		style={{
																			borderTop: `0.5px solid ${theme.divider}`,
																		}}
																	>
																		<div className="flex items-center justify-between gap-2">
																			<span
																				className="min-w-0 truncate text-xs font-medium"
																				style={{ color: theme.accent }}
																			>
																				{result.episode}화
																				{result.title
																					? ` · ${result.title}`
																					: ""}
																			</span>

																			<span
																				className="shrink-0 text-[11px] tabular-nums"
																				style={{ color: theme.muted }}
																			>
																				{result.count}건
																			</span>
																		</div>

																		<p
																			className="mt-1 break-words text-sm leading-relaxed"
																			style={{ color: theme.text }}
																		>
																			{result.hasMoreBefore && "…"}
																			{result.before}
																			<mark
																				className="rounded-sm"
																				style={{
																					backgroundColor: `${theme.accent}33`,
																					color: "inherit",
																				}}
																			>
																				{result.match}
																			</mark>
																			{result.after}
																			{result.hasMoreAfter && "…"}
																		</p>
																	</button>
																))}
															</>
														)}
													</div>
												)}
					</div>
				)}

				{/* 회차 목록 */}
				{parsedNovel && episodeListOpen && (
					<div className="mx-auto max-w-5xl px-3 pb-3 md:px-6">
								<div
									className="overflow-hidden rounded-[4px]"
									style={{
										boxShadow: `0 0 0 0.5px ${theme.divider}`,
									}}
								>
									<div
										className="flex items-center gap-2 px-3 py-2.5"
										style={{
											borderBottom: `0.5px solid ${theme.divider}`,
										}}
									>
										<Search
											className="h-4 w-4 shrink-0"
											style={{
												color:
													theme.muted,
											}}
										/>

										<input
											type="text"
											value={
												episodeSearch
											}
											onChange={(
												e
											) =>
												setEpisodeSearch(
													e
														.target
														.value
												)
											}
											placeholder="회차 검색"
											className="min-w-0 flex-1 bg-transparent text-sm outline-none"
											style={{
												color:
													theme.title,
											}}
										/>

										{episodeSearch && (
											<button
												onClick={() =>
													setEpisodeSearch(
														""
													)
												}
												className="shrink-0"
												style={{
													color:
														theme.muted,
												}}
												aria-label="회차 검색어 지우기"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										)}
									</div>

									<div
										ref={
											mobileEpisodeListRef
										}
										className="max-h-72 overflow-y-auto"
									>
										{filteredEpisodes.length ===
										0 ? (
											<p
												className="px-4 py-5 text-center text-xs"
												style={{
													color:
														theme.muted,
												}}
											>
												검색 결과가 없습니다.
											</p>
										) : (
											filteredEpisodes.map(
												(
													episode
												) => {
													const index =
														parsedNovel.episodes.indexOf(
															episode
														);

													const isSelected =
														index ===
														selectedEpisodeIndex;

													return (
														<button
															key={`${episode.startLine}-${index}`}
															data-episode-index={
																index
															}
															onClick={() =>
																changeEpisode(
																	index
																)
															}
															disabled={
																progressSaving
															}
															className="w-full border-b px-4 py-3 text-left transition last:border-b-0 disabled:opacity-50"
															style={{
																borderColor:
																	theme.divider,
																borderLeft: `2px solid ${
																	isSelected
																		? theme.accent
																		: "transparent"
																}`,
																backgroundColor:
																	isSelected
																		? `${theme.accent}0c`
																		: "transparent",
															}}
														>
															<div className="flex items-center gap-2">
																<span
																	className="shrink-0 text-xs tabular-nums"
																	style={{
																		color:
																			isSelected
																				? theme.accent
																				: theme.muted,
																	}}
																>
																	{episode.label ?? `${episode.episode}화`}
																</span>

																<span
																	className="min-w-0 truncate text-sm"
																	style={{
																		fontFamily:
																			SERIF,
																		color:
																			isSelected
																				? theme.title
																				: theme.text,
																		fontWeight:
																			isSelected
																				? 500
																				: 400,
																	}}
																>
																	{
																		episode.title
																	}
																</span>
															</div>
														</button>
													);
												}
											)
										)}
									</div>

									<div
										className="border-t px-4 py-3"
										style={{ borderColor: theme.divider }}
									>
										<button
											type="button"
											onClick={() =>
												setInspectResult(
													inspectResult
														? null
														: inspectParsing(
																fileContent,
																selectedRuleOptions
															)
												)
											}
											className="text-xs underline"
											style={{ color: theme.muted }}
										>
											{inspectResult ? "점검 닫기" : "회차 점검"}
										</button>

										{inspectResult && (
											<div
												className="mt-2 space-y-2 text-xs"
												style={{ color: theme.text }}
											>
												<p>
													{`잡힌 회차 ${inspectResult.count}개 · 마지막 번호 ${
														inspectResult.lastNumber ?? "-"
													}`}
												</p>

												{inspectResult.issues.length === 0 ? (
													<p style={{ color: theme.muted }}>
														빠지거나 겹친 회차를 찾지 못했어요.
													</p>
												) : (
													inspectResult.issues.map((issue, i) => (
														<div key={i}>
															<p>{issue.message}</p>
															{issue.lines?.map((line, j) => (
																<p
																	key={j}
																	className="truncate"
																	style={{ color: theme.muted }}
																>
																	{line}
																</p>
															))}
														</div>
													))
												)}
											</div>
										)}
									</div>
								</div>
					</div>
				)}
			</header>


			<section
				className="mx-auto max-w-5xl px-5 pb-24 md:px-8"
				style={{
					paddingTop:
						"calc(4.5rem + env(safe-area-inset-top, 0px))",
				}}
			>
				{!parsedNovel ? (
					<div
						className="px-6 py-14 text-center text-sm"
						style={{
							color:
								theme.muted,
						}}
					>
						파싱 결과를 불러오는 중...
					</div>
				) : parsedNovel.episodes.length ===
					0 ? (
					<div className="px-6 py-14 text-center">
						<p
							className="text-sm"
							style={{
								color:
									theme.text,
							}}
						>
							회차를 찾지 못했습니다.
						</p>

						<p
							className="mt-2 text-xs"
							style={{
								color:
									theme.muted,
							}}
						>
							원문은 정상적으로 가져왔지만
							회차 구조를 인식하지 못했습니다.
						</p>

						<details className="mt-6 text-left">
							<summary
								className="cursor-pointer text-xs"
								style={{
									color:
										theme.muted,
								}}
							>
								원문 보기
							</summary>

							<pre
								className="mt-4 whitespace-pre-wrap break-words text-sm leading-8"
								style={{
									fontFamily:
										SERIF,
									color:
										theme.text,
								}}
							>
								{fileContent}
							</pre>
						</details>
					</div>
				) : (
					<>


						<div className="grid grid-cols-1 gap-6">
							<aside className="hidden">
								<div className="sticky top-8">
									<div
										className="mb-4 flex items-center gap-2 rounded-[4px] px-3 py-2"
										style={{
											boxShadow: `0 0 0 0.5px ${theme.divider}`,
										}}
									>
										<Search
											className="h-4 w-4 shrink-0"
											style={{
												color:
													theme.muted,
											}}
										/>

										<input
											type="text"
											value={
												episodeSearch
											}
											onChange={(
												e
											) =>
												setEpisodeSearch(
													e
														.target
														.value
												)
											}
											placeholder="회차 검색"
											className="min-w-0 flex-1 bg-transparent text-sm outline-none"
											style={{
												color:
													theme.title,
											}}
										/>

										{episodeSearch && (
											<button
												onClick={() =>
													setEpisodeSearch(
														""
													)
												}
												className="shrink-0"
												style={{
													color:
														theme.muted,
												}}
												aria-label="회차 검색어 지우기"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										)}
									</div>

									<p
										className="mb-3 px-1 text-xs"
										style={{
											color:
												theme.muted,
										}}
									>
										{episodeSearch
											? `${filteredEpisodes.length}개 회차`
											: `전체 ${parsedNovel.totalEpisodes}화`}
									</p>

									<div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
										{filteredEpisodes.length ===
										0 ? (
											<p
												className="px-2 py-6 text-center text-xs"
												style={{
													color:
														theme.muted,
												}}
											>
												검색 결과가 없습니다.
											</p>
										) : (
											filteredEpisodes.map(
												(
													episode
												) => {
													const index =
														parsedNovel.episodes.indexOf(
															episode
														);

													const isSelected =
														index ===
														selectedEpisodeIndex;

													return (
														<button
															key={`${episode.startLine}-${index}`}
															onClick={() =>
																changeEpisode(
																	index
																)
															}
															disabled={
																progressSaving
															}
															className="flex w-full items-start gap-2.5 rounded-r-[4px] py-2.5 pl-2.5 pr-2 text-left transition disabled:opacity-50"
															style={{
																color:
																	isSelected
																		? theme.title
																		: theme.muted,
																borderLeft: `2px solid ${
																	isSelected
																		? theme.accent
																		: "transparent"
																}`,
																backgroundColor:
																	isSelected
																		? `${theme.accent}0c`
																		: "transparent",
															}}
														>
															<span
																className="mt-0.5 shrink-0 text-[11px] tabular-nums"
																style={{
																	color:
																		isSelected
																			? theme.accent
																			: theme.muted,
																	opacity:
																		isSelected
																			? 1
																			: 0.7,
																}}
															>
																{episode.label ?? `${episode.episode}화`}
															</span>

															<p
																className="min-w-0 truncate text-sm"
																style={{
																	fontFamily:
																		SERIF,
																	fontWeight:
																		isSelected
																			? 500
																			: 400,
																}}
															>
																{
																	episode.title
																}
															</p>
														</button>
													);
												}
											)
										)}
									</div>
								</div>
							</aside>


							<article>
								{selectedEpisode ? (
									<>
										<div
											className="px-1 py-2 md:px-2"
											style={{
												borderTop: `0.5px solid ${theme.divider}`,
											}}
										>
											<div className="pt-6">
												<p
													className="text-xs tracking-wide"
													style={{
														color:
															theme.accent,
													}}
												>
													{
														selectedEpisode.episode
													}
													화
												</p>

												<h2
													className="mt-2 text-xl font-medium md:text-2xl"
													style={{
														fontFamily:
															SERIF,
													}}
												>
													{
														selectedEpisode.title
													}
												</h2>






												{editError && (
													<p className="mt-2 text-xs text-red-500">
														{
															editError
														}
													</p>
												)}


												{editingContent ? (
													<div className="mx-auto mt-8 max-w-2xl">
														<label
															className="mb-1 block text-xs"
															style={{ color: theme.muted }}
														>
															제목
														</label>
														<input
															type="text"
															value={editedTitle}
															onChange={(event) =>
																setEditedTitle(event.target.value)
															}
															disabled={savingEdit}
															className="mb-3 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
															style={{
																fontFamily,
																fontSize: `${fontSize}px`,
																color: theme.title,
																borderColor: theme.divider,
																backgroundColor: "transparent",
															}}
														/>
														<p
															className="mb-3 text-[11px]"
															style={{ color: theme.muted }}
														>
															회차 규칙에 맞는 형식(예: 제목 앞의 번호)은 유지해 주세요.
														</p>
														<textarea
															value={
																editedText
															}
															onChange={(
																event
															) =>
																setEditedText(
																	event
																		.target
																		.value
																)
															}
															disabled={
																savingEdit
															}
															className="w-full resize-y whitespace-pre-wrap break-words rounded-lg border p-4 outline-none focus:ring-2"
															style={{
																fontFamily,
																fontSize: `${fontSize}px`,
																lineHeight,
																letterSpacing: `${letterSpacing}em`,
																color:
																	theme.text,
																minHeight:
																	"50vh",
																borderColor:
																	theme.divider,
															}}
														/>

														<div className="mt-4 flex items-center justify-end gap-2">
															<button
																onClick={
																	cancelEditingContent
																}
																disabled={
																	savingEdit
																}
																className="rounded-lg px-4 py-2 text-sm transition disabled:opacity-50"
																style={{
																	color:
																		theme.muted,
																}}
															>
																취소
															</button>

															<button
																onClick={
																	saveEditedContent
																}
																disabled={
																	savingEdit
																}
																className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
																style={{
																	backgroundColor:
																		theme.accent,
																}}
															>
																{savingEdit ? (
																	<Loader2 className="h-4 w-4 animate-spin" />
																) : (
																	<Check className="h-4 w-4" />
																)}

																{savingEdit
																	? "저장 중..."
																	: "확인"}
															</button>
														</div>
													</div>
												) : (
													<div
														className="mx-auto mt-8 max-w-2xl"
														onClick={
															handleContentTap
														}
													>
														<div
															ref={
																contentRef
															}
															onMouseUp={
																handleTextSelection
															}
															onTouchEnd={
																handleTextSelection
															}
															className="whitespace-pre-wrap break-words"
															style={{
																fontFamily,
																fontSize: `${fontSize}px`,
																lineHeight,
																letterSpacing: `${letterSpacing}em`,
																color:
																	theme.text,
																userSelect:
																	"text",
															}}
														>
															{highlightedContent}
														</div>
													</div>
												)}


											</div>
										</div>


									</>
								) : (
									<div
										className="flex h-full items-center justify-center text-sm"
										style={{
											color:
												theme.muted,
										}}
									>
										회차를 선택하세요.
									</div>
								)}
							</article>
						</div>
					</>
				)}
			</section>


			{marathon && marathonProgress > 0 && (
				<div
					className="pointer-events-none fixed inset-x-0 z-[55] flex justify-center"
					style={{ bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
				>
					<div
						className="rounded-full px-4 py-2 text-xs shadow-lg"
						style={{
							backgroundColor: theme.title,
							color: theme.bg,
							opacity: 0.35 + marathonProgress * 0.65,
						}}
					>
						{marathonProgress >= 1
							? "다음 화로 이동 중…"
							: "조금 더 내리면 다음 화"}
					</div>
				</div>
			)}

			{showHighlightButton &&
				selectedTextForHighlight && (
					<div
						className="fixed left-1/2 z-[60] -translate-x-1/2 md:hidden"
						style={{
							bottom:
								"calc(5.5rem + env(safe-area-inset-bottom, 0px))",
						}}
					>
						<button
							onMouseDown={(e) =>
								e.preventDefault()
							}
							onTouchStart={(e) =>
								e.preventDefault()
							}
							onClick={
								savePendingHighlight
							}
							disabled={
								highlightLoading
							}
							aria-label="하이라이트"
							className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition disabled:opacity-60"
							style={{
								backgroundColor:
									theme.title,
								color:
									theme.bg,
							}}
						>
							{highlightLoading ? (
								<Loader2 className="h-5 w-5 animate-spin" />
							) : (
								<span
									aria-hidden="true"
									className="text-xl leading-none"
								>
									🖍
								</span>
							)}
						</button>
					</div>
				)}


			<div
				className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col items-end gap-3 px-4 transition-opacity duration-300 ${
					chromeVisible ||
					settingsOpen
						? "opacity-100"
						: "pointer-events-none opacity-0"
				}`}
				style={{
					paddingBottom:
						"max(1rem, env(safe-area-inset-bottom, 0px))",
				}}
			>
				{settingsOpen && (
					<ReaderSettingsPanel
						theme={theme}
						themeKey={themeKey}
						setThemeKey={setThemeKey}
						fontSize={fontSize}
						setFontSize={setFontSize}
						fontKey={fontKey}
						setFontKey={setFontKey}
						lineHeight={lineHeight}
						setLineHeight={setLineHeight}
						letterSpacing={letterSpacing}
						setLetterSpacing={setLetterSpacing}
						marathon={marathon}
						setMarathon={setMarathon}
						editingContent={editingContent}
						onOpenEpisodeEdit={() =>
							setEpisodeEditPanelOpen(true)
						}
						onEditContent={startEditingContent}
						onClose={() => setSettingsOpen(false)}
					/>
				)}


				{/* 회차 수정 패널 */}
				{episodeEditPanelOpen && (
					<div
						className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
						role="dialog"
						aria-modal="true"
						aria-label="회차 수정"
					>
						<button
							type="button"
							aria-label="회차 수정 닫기"
							onClick={() =>
								setEpisodeEditPanelOpen(
									false
								)
							}
							className="absolute inset-0"
							style={{
								backgroundColor:
									"rgba(0,0,0,0.35)",
							}}
						/>

						<div
							className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl p-5 sm:rounded-2xl"
							style={{
								backgroundColor:
									theme.bg,
								color:
									theme.title,
								boxShadow:
									"0 8px 40px rgba(0,0,0,0.22)",
							}}
						>
							<div className="mb-4 flex items-center justify-between">
								<p
									className="text-sm font-semibold"
									style={{
										color:
											theme.title,
									}}
								>
									회차 수정
								</p>

								<button
									type="button"
									onClick={() =>
										setEpisodeEditPanelOpen(
											false
										)
									}
									aria-label="닫기"
									className="flex h-8 w-8 items-center justify-center rounded-full hover:opacity-70"
									style={{
										color:
											theme.muted,
									}}
								>
									<X className="h-4 w-4" />
								</button>
							</div>


							<p
								className="mb-2 text-xs font-semibold"
								style={{
									color:
										theme.text,
								}}
							>
								회차 규칙 추가
							</p>

							<p
								className="mb-3 text-[11px] leading-5"
								style={{
									color:
										theme.muted,
								}}
							>
								이 소설에 바로 적용할 회차 형식을
								추가합니다. 추가한 규칙은 다른 소설의
								규칙 목록에도 나타납니다.
								<br />
								숫자 부분은{" "}
								<b>xxx</b>로 입력하세요.
							</p>


							<div className="mb-3 flex gap-2">
								<input
									type="text"
									value={
										episodeRuleInput
									}
									onChange={(
										event
									) =>
										setEpisodeRuleInput(
											event
												.target
												.value
										)
									}
									onKeyDown={(
										event
									) => {
										if (
											event.key ===
												"Enter" &&
											!episodeRuleSaving
										) {
											void addEpisodeRule();
										}
									}}
									placeholder="예: 외전 제xxx화"
									className="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none"
									style={{
										color:
											theme.title,
										backgroundColor:
											theme.bg,
										border: `1px solid ${theme.divider}`,
									}}
									disabled={
										episodeRuleSaving
									}
								/>

								<button
									type="button"
									onClick={() =>
										void addEpisodeRule()
									}
									disabled={
										episodeRuleSaving ||
										!episodeRuleInput.trim()
									}
									className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40"
									style={{
										backgroundColor:
											theme.title,
										color:
											theme.bg,
									}}
								>
									{episodeRuleSaving
										? "저장 중"
										: "추가"}
								</button>
							</div>


							{episodeRuleError && (
								<p className="mb-4 text-[11px] text-red-500">
									{
										episodeRuleError
									}
								</p>
							)}


							<button
								type="button"
								onClick={() => {
									setEpisodeRuleManagerOpen(
										true
									);
								}}
								className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:opacity-80"
								style={{
									backgroundColor:
										theme.divider,
								}}
							>
								<div className="min-w-0">
									<p
										className="text-xs font-medium"
										style={{
											color:
												theme.title,
										}}
									>
										이 소설의 회차 규칙
									</p>

									<p
										className="mt-0.5 text-[10px]"
										style={{
											color:
												theme.muted,
										}}
									>
										{`현재: ${selectedRuleOptions
											.map((option) => option.label)
											.join(", ")} (${
											ruleSource === "manual"
												? "직접 선택"
												: ruleSource === "auto"
													? "자동 감지"
													: "기본값"
										})`}
									</p>
								</div>

								<ChevronRight
									className="h-4 w-4 shrink-0"
									style={{
										color:
											theme.muted,
									}}
								/>
							</button>
						</div>
					</div>
				)}


				<nav
					aria-label="리더 메뉴"
					className="flex w-full items-center justify-between gap-1 rounded-full px-2 py-2"
					style={{
						backgroundColor:
							theme.bg,
						color:
							theme.title,
						border: `0.5px solid ${theme.divider}`,
						boxShadow:
							"0 4px 20px rgba(0,0,0,0.18)",
					}}
				>
					<button
						type="button"
						onClick={
							goToPrevEpisode
						}
						disabled={
							isFirstEpisode ||
							progressSaving
						}
						aria-label="이전화"
						className="flex h-10 items-center gap-0.5 rounded-full pl-2 pr-3 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
						style={{
							color:
								theme.title,
						}}
					>
						<ChevronLeft className="h-4 w-4" />
						이전화
					</button>

					<div className="flex items-center">
						<button
							type="button"
							onClick={() => {
								window.scrollTo({
									top: 0,
									behavior:
										"smooth",
								});
							}}
							aria-label="페이지 맨 위로 이동"
							className="flex h-10 w-10 items-center justify-center rounded-full transition hover:opacity-80"
							style={{
								color:
									theme.muted,
							}}
						>
							<ChevronUp className="h-5 w-5" />
						</button>

						<button
							type="button"
							onClick={() =>
								setSettingsOpen(
									(v) => !v
								)
							}
							aria-label="읽기 설정 열기"
							className="flex h-10 w-10 items-center justify-center rounded-full transition hover:opacity-90"
							style={{
								backgroundColor:
									theme.title,
								color:
									theme.bg,
							}}
						>
							<Settings className="h-4 w-4" />
						</button>

						<button
							type="button"
							onClick={() => {
								window.scrollTo({
									top:
										document
											.documentElement
											.scrollHeight,
									behavior:
										"smooth",
								});
							}}
							aria-label="페이지 맨 아래로 이동"
							className="flex h-10 w-10 items-center justify-center rounded-full transition hover:opacity-80"
							style={{
								color:
									theme.muted,
							}}
						>
							<ChevronDown className="h-5 w-5" />
						</button>
					</div>

					<button
						type="button"
						onClick={
							goToNextEpisode
						}
						disabled={
							isLastEpisode ||
							progressSaving
						}
						aria-label="다음화"
						className="flex h-10 items-center gap-0.5 rounded-full pl-3 pr-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
						style={{
							color:
								theme.title,
						}}
					>
						다음화
						<ChevronRight className="h-4 w-4" />
					</button>
				</nav>
			</div>


			{/* 등록된 회차 규칙 관리 */}
			{episodeRuleManagerOpen && (
				<div
					className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
					role="dialog"
					aria-modal="true"
					aria-label="회차 규칙 관리"
				>
					<button
						type="button"
						aria-label="회차 규칙 관리 닫기"
						onClick={() =>
							setEpisodeRuleManagerOpen(
								false
							)
						}
						className="absolute inset-0"
						style={{
							backgroundColor:
								"rgba(0,0,0,0.35)",
						}}
					/>


					<div
						className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl"
						style={{
							backgroundColor:
								theme.bg,
							color:
								theme.title,
							boxShadow:
								"0 8px 40px rgba(0,0,0,0.22)",
							maxHeight:
								"min(720px, 90vh)",
						}}
					>
						<div
							className="flex shrink-0 items-center justify-between px-5 py-4"
							style={{
								borderBottom: `0.5px solid ${theme.divider}`,
							}}
						>
							<div className="flex min-w-0 items-center gap-3">
								<button
									type="button"
									onClick={() =>
										setEpisodeRuleManagerOpen(
											false
										)
									}
									className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:opacity-70"
									style={{
										backgroundColor:
											theme.divider,
										color:
											theme.title,
									}}
									aria-label="회차 설정으로 돌아가기"
								>
									<ArrowLeft className="h-4 w-4" />
								</button>

								<div className="min-w-0">
									<p className="text-sm font-semibold">
										등록된 회차 규칙
									</p>

									<p
										className="mt-0.5 text-[10px]"
										style={{
											color:
												theme.muted,
										}}
									>
										여러 개를 고를 수 있습니다. 확인을 누르면 적용됩니다
									</p>
								</div>
							</div>


							<button
								type="button"
								onClick={() =>
									setEpisodeRuleManagerOpen(
										false
									)
								}
								className="flex h-8 w-8 items-center justify-center rounded-full hover:opacity-70"
								style={{
									color:
										theme.muted,
								}}
								aria-label="닫기"
							>
								<X className="h-4 w-4" />
							</button>
						</div>


						<div className="shrink-0 px-5 py-4">
							<div
								className="flex items-center gap-2 rounded-lg px-3 py-2.5"
								style={{
									border: `1px solid ${theme.divider}`,
								}}
							>
								<Search
									className="h-4 w-4 shrink-0"
									style={{
										color:
											theme.muted,
									}}
								/>

								<input
									type="text"
									value={
										episodeRuleSearch
									}
									onChange={(
										event
									) =>
										setEpisodeRuleSearch(
											event
												.target
												.value
										)
									}
									placeholder="규칙 검색"
									className="min-w-0 flex-1 bg-transparent text-sm outline-none"
									style={{
										color:
											theme.title,
									}}
									autoFocus
								/>

								{episodeRuleSearch && (
									<button
										type="button"
										onClick={() =>
											setEpisodeRuleSearch(
												""
											)
										}
										className="shrink-0"
										style={{
											color:
												theme.muted,
										}}
										aria-label="규칙 검색어 지우기"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								)}
							</div>


							{episodeRuleSearch && (
								<p
									className="mt-2 px-1 text-[10px]"
									style={{
										color:
											theme.muted,
									}}
								>
									{
										filteredRuleOptions.length
									}
									개 검색됨
								</p>
							)}
						</div>


						<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
							<div className="space-y-2">
								{recommendedRuleKey &&
									!episodeRuleSearch &&
									ruleStats &&
									(() => {
										const recommended =
											ruleOptions.find(
												(option) =>
													option.key ===
													recommendedRuleKey
											);

										if (!recommended) {
											return null;
										}

										return (
											<button
												type="button"
												onClick={() =>
													setPendingRuleKeys([
														recommended.key,
													])
												}
												className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:opacity-80"
												style={{
													border: `1px dashed ${theme.accent}`,
													color: theme.text,
												}}
											>
												<p className="min-w-0 flex-1 break-all text-sm">
													추천: {recommended.label} (
													{ruleStats[recommended.key]
														?.count ?? 0}
													개 화)
												</p>
											</button>
										);
									})()}

								{filteredRuleOptions.length === 0 ? (
									<div className="py-12 text-center">
										<Search
											className="mx-auto mb-3 h-5 w-5"
											style={{ color: theme.muted }}
										/>

										<p
											className="text-xs"
											style={{ color: theme.text }}
										>
											검색 결과가 없습니다.
										</p>

										<button
											type="button"
											onClick={() =>
												setEpisodeRuleSearch("")
											}
											className="mt-2 text-[10px] hover:opacity-70"
											style={{ color: theme.accent }}
										>
											검색어 초기화
										</button>
									</div>
								) : (
									filteredRuleOptions.map((option) => {
										const picked =
											pendingRuleKeys.includes(
												option.key
											);

										const applied =
											selectedRuleKeys.includes(
												option.key
											);

										const count =
											ruleStats?.[option.key]?.count;

										if (editingRuleKey === option.key) {
											return (
												<div
													key={option.key}
													className="space-y-2 rounded-xl p-3"
													style={{
														backgroundColor: theme.divider,
														border: `1px solid ${theme.accent}`,
													}}
												>
													<input
														value={editingRuleText}
														onChange={(event) =>
															setEditingRuleText(
																event.target.value
															)
														}
														placeholder="예: * xxx화$"
														className="w-full rounded-lg px-3 py-2 text-sm outline-none"
														style={{
															backgroundColor: theme.bg,
															color: theme.text,
														}}
													/>

													<p
														className="text-[10px] leading-relaxed"
														style={{ color: theme.muted }}
													>
														xxx = 번호 자리 · * = 아무 글자 · $ = 줄이
														거기서 끝남. 모든 소설에 공통으로 바뀝니다.
													</p>

													<div className="flex gap-2">
														<button
															type="button"
															onClick={() => {
																void saveRuleEdit(
																	option,
																	editingRuleText
																).then((ok) => {
																	if (ok) {
																		setEditingRuleKey(null);
																	}
																});
															}}
															disabled={episodeRuleSaving}
															className="rounded-lg px-4 py-2 text-[11px] font-medium transition hover:opacity-80 disabled:opacity-40"
															style={{
																backgroundColor: theme.title,
																color: theme.bg,
															}}
														>
															저장
														</button>

														<button
															type="button"
															onClick={() =>
																setEditingRuleKey(null)
															}
															className="rounded-lg px-4 py-2 text-[11px] transition hover:opacity-70"
															style={{
																backgroundColor: theme.bg,
																color: theme.muted,
															}}
														>
															취소
														</button>

														{option.overridden && (
															<button
																type="button"
																onClick={() => {
																	void resetRuleEdit(
																		option
																	).then((ok) => {
																		if (ok) {
																			setEditingRuleKey(null);
																		}
																	});
																}}
																disabled={episodeRuleSaving}
																className="ml-auto rounded-lg px-3 py-2 text-[11px] transition hover:opacity-70 disabled:opacity-40"
																style={{
																	backgroundColor: theme.bg,
																	color: theme.accent,
																}}
															>
																원래대로
															</button>
														)}
													</div>
												</div>
											);
										}

										return (
											<div
												key={option.key}
												className="flex items-center gap-2"
											>
												<button
													type="button"
													onClick={() =>
														togglePendingRuleKey(
															option.key
														)
													}
													className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:opacity-80"
													style={{
														backgroundColor: theme.divider,
														border: picked
															? `1px solid ${theme.accent}`
															: "1px solid transparent",
													}}
												>
													<span className="flex h-4 w-4 shrink-0 items-center justify-center">
														{picked && (
															<Check
																className="h-4 w-4"
																style={{
																	color: theme.accent,
																}}
															/>
														)}
													</span>

													<div className="min-w-0 flex-1">
														<p
															className="break-all text-sm"
															style={{ color: theme.text }}
														>
															{option.label}
														</p>

														<p
															className="mt-1 text-[10px]"
															style={{ color: theme.muted }}
														>
															{option.kind === "custom"
																? "내가 추가한 규칙"
																: option.hint}
															{typeof count === "number" &&
																` · 이 소설 ${count}개 화`}
															{applied && " · 적용 중"}
														</p>
													</div>
												</button>

												<button
													type="button"
													onClick={() => {
														setEditingRuleText(
															option.rule ??
																option.seedRule ??
																option.label
														);
														setEditingRuleKey(option.key);
													}}
													className="shrink-0 rounded-lg px-3 py-2 text-[11px] transition hover:opacity-60"
													style={{
														color: theme.muted,
														backgroundColor: theme.bg,
													}}
												>
													수정
												</button>

												{option.kind === "custom" &&
													option.ruleId && (
														<button
															type="button"
															onClick={() => {
																if (option.ruleId) {
																	void deleteEpisodeRule(
																		option.ruleId
																	);
																}
															}}
															className="shrink-0 rounded-lg px-3 py-2 text-[11px] transition hover:opacity-60"
															style={{
																color: theme.muted,
																backgroundColor: theme.bg,
															}}
														>
															삭제
														</button>
													)}
											</div>
										);
									})
								)}

								{!episodeRuleSearch &&
									(hiddenRuleCount > 0 ||
										showAllRules) && (
										<button
											type="button"
											onClick={() =>
												setShowAllRules(
													(previous) => !previous
												)
											}
											className="w-full rounded-lg px-4 py-3 text-center text-[11px] transition hover:opacity-70"
											style={{
												color: theme.accent,
											}}
										>
											{showAllRules
												? "안 맞는 규칙 접기"
												: `이 소설에 안 맞는 규칙 ${hiddenRuleCount}개 보기`}
										</button>
									)}
							</div>
						</div>


						<div
							className="shrink-0 px-5 py-4"
							style={{
								borderTop: `0.5px solid ${theme.divider}`,
							}}
						>
							{episodeRuleError && (
								<p className="mb-3 text-[11px] text-red-500">
									{episodeRuleError}
								</p>
							)}

							<button
								type="button"
								onClick={() => {
									void confirmRuleSelection().then(
										(ok) => {
											if (ok) {
												setEpisodeRuleManagerOpen(
													false
												);
											}
										}
									);
								}}
								disabled={episodeRuleSaving}
								className="w-full rounded-lg px-4 py-2.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-40"
								style={{
									backgroundColor: theme.title,
									color: theme.bg,
								}}
							>
								{episodeRuleSaving ? "저장 중" : "확인"}
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
