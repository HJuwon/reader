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

import {
	useRef,
	useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { useReadingProgress } from "./hooks/useReadingProgress";
import { useEpisodeRules } from "./hooks/useEpisodeRules";
import { useBodySearch } from "./hooks/useBodySearch";
import { useContentEditor } from "./hooks/useContentEditor";
import { useEpisodeNavigation } from "./hooks/useEpisodeNavigation";
import { useFileClose } from "./hooks/useFileClose";
import { useReaderChrome } from "./hooks/useReaderChrome";
import { useEpisodeList } from "./hooks/useEpisodeList";
import { useEpisodePanel } from "./hooks/useEpisodePanel";
import { useFileOpen } from "./hooks/useFileOpen";
import { useHighlightRenderer } from "./hooks/useHighlightRenderer";

import {
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
	THEMES,
	useReaderSettings,
	type ThemeKey,
} from "./hooks/useReaderSettings";

import {
	ArrowLeft,
	Bookmark,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	ListOrdered,
	Loader2,
	Pencil,
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
		episodeRulesLoading,
		episodeRuleSaving,
		episodeRuleError,
		episodeRuleSearch,
		setEpisodeRuleSearch,
		filteredEpisodeRules,
		loadEpisodeRules,
		addEpisodeRule,
		deleteEpisodeRule,
		reparseWithRules,
	} = useEpisodeRules({
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
		savingEdit,
		editError,
		setEditedText,
		startEditingContent,
		cancelEditingContent,
		saveEditedContent,
	} = useContentEditor({
		fileContent,
		selectedFile,
		selectedEpisode,
		episodeRules,
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
	} = useBodySearch({
		contentRef,
		selectedEpisodeContent:
			selectedEpisode?.content,
		selectedEpisodeIndex,
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
			<header
				className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
					chromeVisible
						? "max-h-40 opacity-100"
						: "max-h-0 opacity-0"
				}`}
			>
				<div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 md:px-8 md:py-8">
					<div className="min-w-0">
						<button
							onClick={closeFile}
							className="mb-3 flex items-center gap-2 text-sm hover:opacity-70"
							style={{
								color:
									theme.muted,
							}}
						>
							<ArrowLeft className="h-4 w-4" />
							돌아가기
						</button>

						<h1
							className="truncate text-xl font-medium md:text-2xl"
							style={{
								fontFamily:
									SERIF,
							}}
						>
							{selectedFile.name}
						</h1>
					</div>

					{parsedNovel && (
						<div className="ml-6 shrink-0 text-right">
							<p
								className="text-xs"
								style={{
									color:
										theme.muted,
								}}
							>
								전체 회차
							</p>

							<p className="font-medium">
								{
									parsedNovel.totalEpisodes
								}
								화
							</p>

							{progressSaving && (
								<p
									className="mt-1 text-[10px]"
									style={{
										color:
											theme.muted,
									}}
								>
									저장 중...
								</p>
							)}
						</div>
					)}
				</div>
			</header>


			<section className="mx-auto max-w-5xl px-5 pb-24 md:px-8">
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
						<div className="mb-5 md:hidden">
							<button
								type="button"
								onClick={() =>
									setEpisodeListOpen(
										(open) =>
											!open
									)
								}
								className="flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-left transition hover:opacity-80"
								style={{
									backgroundColor:
										theme.divider,
								}}
								aria-expanded={
									episodeListOpen
								}
								aria-label="회차 목록 열기"
							>
								<span
									className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
									style={{
										color:
											theme.bg,
										backgroundColor:
											theme.accent,
									}}
								>
									회차
								</span>

								{selectedEpisode && (
									<span
										className="min-w-0 flex-1 truncate text-sm"
										style={{
											fontFamily:
												SERIF,
											color:
												theme.title,
										}}
									>
										{
											selectedEpisode.title
										}
									</span>
								)}

								{episodeListOpen ? (
									<ChevronUp
										className="ml-auto h-4 w-4 shrink-0"
										style={{
											color:
												theme.muted,
										}}
									/>
								) : (
									<ChevronDown
										className="ml-auto h-4 w-4 shrink-0"
										style={{
											color:
												theme.muted,
										}}
									/>
								)}
							</button>

							{episodeListOpen && (
								<div
									className="mt-2 overflow-hidden rounded-[4px]"
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
																	{
																		episode.episode
																	}
																	화
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
								</div>
							)}
						</div>


						<div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
							<aside className="hidden md:block">
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
																{
																	episode.episode
																}
																화
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


												<div className="mt-4 flex items-center gap-2">
													<button
														onClick={
															toggleBookmark
														}
														disabled={
															bookmarkLoading
														}
														aria-label={
															bookmarked
																? "북마크 해제"
																: "북마크"
														}
														className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
															bodySearchOpen
																? "hidden sm:flex"
																: ""
														}`}
														style={{
															color:
																bookmarked
																	? theme.accent
																	: theme.muted,
															backgroundColor:
																bookmarked
																	? `${theme.accent}14`
																	: theme.divider,
														}}
													>
														<Bookmark
															className="h-3.5 w-3.5"
															fill={
																bookmarked
																	? "currentColor"
																	: "none"
															}
														/>

														{bookmarked
															? "북마크됨"
															: "북마크"}
													</button>


													{!bodySearchOpen ? (
														<button
															onClick={() => {
																setBodySearchOpen(
																	true
																);

																setBodySearchIndex(
																	0
																);
															}}
															className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition hover:opacity-80"
															style={{
																color:
																	theme.muted,
																backgroundColor:
																	theme.divider,
															}}
														>
															<Search className="h-3.5 w-3.5" />
															본문 검색
														</button>
													) : (
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
																		scrollToBodySearchMatch(
																			1
																		);
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
																placeholder="본문에서 검색"
																className="min-w-0 flex-1 bg-transparent text-sm outline-none"
																style={{
																	color:
																		theme.title,
																}}
															/>

															{bodySearch.trim() && (
																<span
																	className="shrink-0 text-[11px] tabular-nums"
																	style={{
																		color:
																			theme.muted,
																	}}
																>
																	{bodySearchMatches.length >
																	0
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
																className="shrink-0 rounded-full p-1 disabled:opacity-30"
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
																className="shrink-0 rounded-full p-1 disabled:opacity-30"
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
													)}
												</div>


												{editError && (
													<p className="mt-2 text-xs text-red-500">
														{
															editError
														}
													</p>
												)}


												{editingContent ? (
													<div className="mx-auto mt-8 max-w-2xl">
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
																fontFamily:
																	SERIF,
																fontSize: `${fontSize}px`,
																lineHeight: 2,
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
																fontFamily:
																	SERIF,
																fontSize: `${fontSize}px`,
																lineHeight: 2,
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


												<div className="mx-auto mt-10 hidden max-w-2xl items-center justify-between md:flex">
													<button
														onClick={
															goToPrevEpisode
														}
														disabled={
															isFirstEpisode ||
															progressSaving
														}
														className="rounded-[4px] px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
														style={{
															backgroundColor:
																theme.divider,
															color:
																theme.title,
														}}
													>
														← 이전화
													</button>

													<button
														onClick={
															goToNextEpisode
														}
														disabled={
															isLastEpisode ||
															progressSaving
														}
														className="rounded-[4px] px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
														style={{
															backgroundColor:
																theme.divider,
															color:
																theme.title,
														}}
													>
														다음화 →
													</button>
												</div>
											</div>
										</div>


										<div className="mt-4 flex items-center justify-between gap-3 md:hidden">
											<button
												onClick={
													goToPrevEpisode
												}
												disabled={
													isFirstEpisode ||
													progressSaving
												}
												className="flex flex-1 items-center justify-center gap-1 rounded-[4px] px-3 py-3 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
												style={{
													backgroundColor:
														theme.divider,
													color:
														theme.title,
												}}
											>
												<ChevronLeft className="h-4 w-4" />
												이전화
											</button>

											<button
												onClick={
													goToNextEpisode
												}
												disabled={
													isLastEpisode ||
													progressSaving
												}
												className="flex flex-1 items-center justify-center gap-1 rounded-[4px] px-3 py-3 text-sm font-medium transition hover:opacity-80 disabled:opacity-30"
												style={{
													backgroundColor:
														theme.divider,
													color:
														theme.title,
												}}
											>
												다음화
												<ChevronRight className="h-4 w-4" />
											</button>
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


			{showHighlightButton &&
				selectedTextForHighlight && (
					<div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 md:hidden">
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
							className="rounded-full px-5 py-3 text-sm font-medium shadow-lg transition disabled:opacity-60"
							style={{
								backgroundColor:
									theme.title,
								color:
									theme.bg,
							}}
						>
							{highlightLoading
								? "저장 중..."
								: "하이라이트"}
						</button>
					</div>
				)}


			<div
				className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 transition-opacity duration-300 ${
					chromeVisible ||
					settingsOpen
						? "opacity-100"
						: "pointer-events-none opacity-0"
				}`}
			>
				{settingsOpen && (
					<div
						className="w-64 rounded-2xl p-5"
						style={{
							backgroundColor:
								theme.bg,
							color:
								theme.title,
							boxShadow:
								"0 4px 20px rgba(0,0,0,0.18)",
							border: `0.5px solid ${theme.divider}`,
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
								읽기 설정
							</p>

							<button
								onClick={() =>
									setSettingsOpen(
										false
									)
								}
								aria-label="설정 닫기"
								className="hover:opacity-70"
								style={{
									color:
										theme.muted,
								}}
							>
								<X className="h-4 w-4" />
							</button>
						</div>


						{!editingContent && (
							<div className="mb-4 grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() =>
										setEpisodeEditPanelOpen(
											true
										)
									}
									className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm transition hover:opacity-80"
									style={{
										color:
											theme.title,
										border: `1px solid ${theme.divider}`,
										backgroundColor:
											theme.bg,
									}}
								>
									<ListOrdered className="h-4 w-4" />
									회차 수정
								</button>

								<button
									type="button"
									onClick={
										startEditingContent
									}
									className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm transition hover:opacity-80"
									style={{
										color:
											theme.title,
										border: `1px solid ${theme.divider}`,
										backgroundColor:
											theme.bg,
									}}
								>
									<Pencil className="h-4 w-4" />
									본문 수정
								</button>
							</div>
						)}


						<p
							className="mb-2 text-xs font-semibold"
							style={{
								color:
									theme.text,
							}}
						>
							글자 크기
						</p>

						<div className="mb-5 flex items-center gap-3">
							<button
								type="button"
								onClick={() =>
									setFontSize(
										(size) =>
											Math.max(
												MIN_FONT_SIZE,
												size -
													1
											)
									)
								}
								disabled={
									fontSize <=
									MIN_FONT_SIZE
								}
								className="shrink-0 text-xs font-medium disabled:opacity-30"
								style={{
									color:
										theme.text,
								}}
							>
								가-
							</button>

							<input
								type="range"
								min={
									MIN_FONT_SIZE
								}
								max={
									MAX_FONT_SIZE
								}
								step={1}
								value={
									fontSize
								}
								onChange={(
									event
								) =>
									setFontSize(
										Number(
											event
												.target
												.value
										)
									)
								}
								className="min-w-0 flex-1"
								aria-label="글자 크기"
							/>

							<button
								type="button"
								onClick={() =>
									setFontSize(
										(size) =>
											Math.min(
												MAX_FONT_SIZE,
												size +
													1
											)
									)
								}
								disabled={
									fontSize >=
									MAX_FONT_SIZE
								}
								className="shrink-0 text-xs font-medium disabled:opacity-30"
								style={{
									color:
										theme.text,
								}}
							>
								가+
							</button>
						</div>


						<p
							className="mb-2 text-xs font-semibold"
							style={{
								color:
									theme.text,
							}}
						>
							배경색
						</p>

						<div className="flex items-center gap-3">
							{(
								Object.keys(
									THEMES
								) as ThemeKey[]
							).map(
								(key) => {
									const t =
										THEMES[
											key
										];

									const isSelected =
										key ===
										themeKey;

									return (
										<button
											key={
												key
											}
											onClick={() =>
												setThemeKey(
													key
												)
											}
											aria-label={
												t.label
											}
											className="flex flex-col items-center gap-1"
										>
											<span
												className="block h-8 w-8 rounded-full"
												style={{
													backgroundColor:
														t.swatch,
													boxShadow:
														isSelected
															? `0 0 0 2px ${t.accent}`
															: `0 0 0 0.5px ${t.divider}`,
												}}
											/>

											<span
												className="text-[10px] font-medium"
												style={{
													color:
														theme.text,
												}}
											>
												{
													t.label
												}
											</span>
										</button>
									);
								}
							)}
						</div>
					</div>
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
								작품 전체에 공통으로 적용할 회차 형식을
								등록할 수 있습니다.
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
										등록된 회차 규칙 관리
									</p>

									<p
										className="mt-0.5 text-[10px]"
										style={{
											color:
												theme.muted,
										}}
									>
										{episodeRules.length >
										0
											? `${episodeRules.length}개의 규칙이 등록되어 있습니다.`
											: "등록된 규칙이 없습니다."}
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


				<div className="flex flex-col items-end gap-1">
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
						className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80"
						style={{
							backgroundColor:
								theme.title,
							color:
								theme.bg,
							boxShadow:
								"0 3px 10px rgba(0,0,0,0.16)",
						}}
					>
						<ChevronUp className="h-4 w-4" />
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
						className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80"
						style={{
							backgroundColor:
								theme.title,
							color:
								theme.bg,
							boxShadow:
								"0 3px 10px rgba(0,0,0,0.16)",
						}}
					>
						<ChevronDown className="h-4 w-4" />
					</button>
				</div>


				<button
					onClick={() =>
						setSettingsOpen(
							(v) => !v
						)
					}
					aria-label="읽기 설정 열기"
					className="flex h-12 w-12 items-center justify-center rounded-full hover:opacity-90"
					style={{
						backgroundColor:
							theme.title,
						color:
							theme.bg,
						boxShadow:
							"0 4px 14px rgba(0,0,0,0.2)",
					}}
				>
					<Settings className="h-5 w-5" />
				</button>
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
										총{" "}
										{
											episodeRules.length
										}
										개
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
									placeholder="등록된 규칙 검색"
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
										filteredEpisodeRules.length
									}
									개 검색됨
								</p>
							)}
						</div>


						<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
							{episodeRulesLoading ? (
								<div className="flex items-center justify-center py-12">
									<div
										className="flex items-center gap-2 text-xs"
										style={{
											color:
												theme.muted,
										}}
									>
										<Loader2 className="h-4 w-4 animate-spin" />
										규칙을 불러오는 중...
									</div>
								</div>
							) : episodeRules.length ===
							  0 ? (
								<div className="py-12 text-center">
									<p
										className="text-xs"
										style={{
											color:
												theme.text,
										}}
									>
										등록된 회차 규칙이 없습니다.
									</p>

									<p
										className="mt-1.5 text-[10px]"
										style={{
											color:
												theme.muted,
										}}
									>
										회차 수정에서 새로운 규칙을
										등록하세요.
									</p>
								</div>
							) : filteredEpisodeRules.length ===
							  0 ? (
								<div className="py-12 text-center">
									<Search
										className="mx-auto mb-3 h-5 w-5"
										style={{
											color:
												theme.muted,
										}}
									/>

									<p
										className="text-xs"
										style={{
											color:
												theme.text,
										}}
									>
										검색 결과가 없습니다.
									</p>

									<button
										type="button"
										onClick={() =>
											setEpisodeRuleSearch(
												""
											)
										}
										className="mt-2 text-[10px] hover:opacity-70"
										style={{
											color:
												theme.accent,
										}}
									>
										검색어 초기화
									</button>
								</div>
							) : (
								<div className="space-y-2">
									{filteredEpisodeRules.map(
										(
											rule
										) => (
											<div
												key={
													rule.id ??
													rule.rule
												}
												className="flex items-center gap-3 rounded-xl px-4 py-3"
												style={{
													backgroundColor:
														theme.divider,
												}}
											>
												<div className="min-w-0 flex-1">
													<p
														className="break-all text-sm"
														style={{
															color:
																theme.text,
														}}
													>
														{
															rule.rule
														}
													</p>

													<p
														className="mt-1 text-[10px]"
														style={{
															color:
																theme.muted,
														}}
													>
														xxx 부분이 숫자로 인식됩니다.
													</p>
												</div>

												<button
													type="button"
													onClick={() => {
														if (
															rule.id
														) {
															void deleteEpisodeRule(
																rule.id
															);
														}
													}}
													disabled={
														!rule.id
													}
													className="shrink-0 rounded-lg px-3 py-2 text-[11px] transition hover:opacity-60 disabled:opacity-30"
													style={{
														color:
															theme.muted,
														backgroundColor:
															theme.bg,
													}}
												>
													삭제
												</button>
											</div>
										)
									)}
								</div>
							)}
						</div>


						<div
							className="shrink-0 px-5 py-4"
							style={{
								borderTop: `0.5px solid ${theme.divider}`,
							}}
						>
							<button
								type="button"
								onClick={() =>
									setEpisodeRuleManagerOpen(
										false
									)
								}
								className="w-full rounded-lg px-4 py-2.5 text-xs font-medium transition hover:opacity-80"
								style={{
									backgroundColor:
										theme.title,
									color:
										theme.bg,
								}}
							>
								확인
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}