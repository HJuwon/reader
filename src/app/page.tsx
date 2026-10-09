"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
	BookOpen,
	RotateCcw,
	ArrowUp,
	Search,
	X,
	MoreVertical,
	ChevronDown,
	Filter,
	LayoutGrid,
	List,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

type Book = {
	id: string;
	drive_file_id: string;
	title: string;
	total_episodes: number;
	last_episode: number;
	progress: number;
	status: "읽는 중" | "완독" | "안 읽음";
	updated_at: string;
	series_status: "ongoing" | "completed";
	round_count?: number;
	completed_round_count?: number;
	current_round?: number | null;
	current_episode?: number | null;
	current_progress?: number | null;
	is_reread_wanted?: boolean;
	is_excluded?: boolean;
};

const statusDot: Record<string, string> = {
	"읽는 중": "bg-[#8a3a3a]",
	완독: "bg-[#4d7c5a]",
	"안 읽음": "bg-stone-300",
};

function ProgressBar({
	percent,
	status,
	dark = false,
}: {
	percent: number;
	status: string;
	dark?: boolean;
}) {
	const value = Math.min(100, Math.max(0, percent));
	const fill = dark
		? "bg-[#e3b27a]"
		: status === "완독"
			? "bg-[#4d7c5a]"
			: status === "읽는 중"
				? "bg-[#8a3a3a]"
				: "bg-stone-300";

	return (
		<div
			className={`h-1 w-full overflow-hidden rounded-full ${
				dark ? "bg-white/15" : "bg-stone-200/80"
			}`}
		>
			<div
				className={`h-full rounded-full transition-all ${fill}`}
				style={{ width: `${value}%` }}
			/>
		</div>
	);
}

// 제목에서 [완결], 1-300화, 확장자 등을 걷어낸 "작품명"만 추출
function getSearchTitle(title: string): string {
	return (
		title
			.replace(/\.(txt|epub|docx?)$/i, "")
			.replace(/[\[(（【][^\])）】]*[\])）】]/g, " ")
			.replace(/\d+\s*[-~]\s*\d+\s*화?/g, " ")
			.replace(/\s+/g, " ")
			.trim() || title
	);
}

function getGoogleSearchUrl(title: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(
		`${getSearchTitle(title)} 웹소설`,
	)}`;
}

// 표지 이미지가 없을 때 쓰는 책 모양 표지 (책등 + 제목)
// 나중에 표지 이미지가 생기면 이 컴포넌트만 바꾸면 됨
function BookCover({
	title,
	className = "",
	textClass = "text-[11px]",
}: {
	title: string;
	className?: string;
	textClass?: string;
}) {
	const name = getSearchTitle(title);

	let hash = 0;
	for (const ch of name) {
		hash = (hash * 31 + ch.codePointAt(0)!) % 360;
	}

	return (
		<div
			aria-hidden
			className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-l-sm rounded-r-md px-2.5 pl-3.5 text-center font-serif font-semibold leading-snug text-white/95 shadow-[0_6px_14px_-4px_rgba(60,40,20,0.45)] ${className}`}
			style={{
				background: `linear-gradient(160deg, hsl(${hash} 34% 38%), hsl(${
					(hash + 25) % 360
				} 38% 24%))`,
			}}
		>
			<span className="absolute inset-y-0 left-0 w-1.5 bg-black/20" />
			<span className="absolute inset-y-0 left-1.5 w-px bg-white/20" />
			<span className={`line-clamp-4 break-keep ${textClass}`}>{name}</span>
			<span className="mt-1.5 h-px w-5 bg-white/40" />
		</div>
	);
}

function getTitleEpisodeCount(title: string): number {
	const matches = [...title.matchAll(/(\d+)\s*[-~]\s*(\d+)/g)];

	if (matches.length === 0) {
		return 0;
	}

	const last = matches[matches.length - 1];

	const count = parseInt(last[2], 10);

	return Number.isFinite(count) ? count : 0;
}

function getEffectiveTotalEpisodes(book: Book): number {
	return Math.max(book.total_episodes || 0, getTitleEpisodeCount(book.title));
}

const TOGGLE_TAGS = ["완결", "미완", "단편", "중편", "장편"] as const;

type ToggleTag = (typeof TOGGLE_TAGS)[number];

const COMPLETION_TAGS: ToggleTag[] = ["완결", "미완"];

const LENGTH_TAGS: ToggleTag[] = ["단편", "중편", "장편"];

function getLengthBucket(book: Book): "단편" | "중편" | "장편" {
	const total = getEffectiveTotalEpisodes(book);

	if (total > 1000) {
		return "장편";
	}

	if (total >= 500) {
		return "중편";
	}

	return "단편";
}

const LIST_PER_PAGE = 20;
const GRID_PER_PAGE = 24;
const PAGE_GROUP_SIZE = 5;

type ManagementFilter = "none" | "reread" | "excluded";

export default function Home() {
	const [books, setBooks] = useState<Book[]>([]);

	const [loading, setLoading] = useState(true);

	const [error, setError] = useState("");

	const [filter, setFilter] = useState("전체");

	const [activeTags, setActiveTags] = useState<Set<ToggleTag>>(() => new Set());

	const [sortOption, setSortOption] = useState<
		"default" | "episodes" | "title"
	>("default");

	const [search, setSearch] = useState("");

	const [showScrollTop, setShowScrollTop] = useState(false);

	const [syncing, setSyncing] = useState(false);

	const [currentPage, setCurrentPage] = useState(1);

	// 페이지 직접 입력용
	const [pageInput, setPageInput] = useState("");

	const [openMenuId, setOpenMenuId] = useState<string | null>(null);

	const [managementFilter, setManagementFilter] =
		useState<ManagementFilter>("none");

	const [managementMenuOpen, setManagementMenuOpen] = useState(false);

	const [tagFilterOpen, setTagFilterOpen] = useState(false);

	const [viewMode, setViewMode] = useState<"list" | "grid">("list");

	const itemsPerPage = viewMode === "grid" ? GRID_PER_PAGE : LIST_PER_PAGE;

	useEffect(() => {
		try {
			if (window.localStorage.getItem("reader:view") === "grid") {
				setViewMode("grid");
			}
		} catch {}
	}, []);

	function changeViewMode(mode: "list" | "grid") {
		setViewMode(mode);

		try {
			window.localStorage.setItem("reader:view", mode);
		} catch {}
	}

	const allBooksSectionRef = useRef<HTMLElement>(null);

	const managementMenuRef = useRef<HTMLDivElement>(null);

	function toggleTag(tag: ToggleTag) {
		setActiveTags((prev) => {
			const next = new Set(prev);

			if (next.has(tag)) {
				next.delete(tag);
			} else {
				next.add(tag);
			}

			return next;
		});
	}

	function resetTags() {
		setActiveTags(new Set());
	}

	function changeSortOption(option: "default" | "episodes" | "title") {
		startTransition(() => {
			setSortOption(option);
		});
	}

	async function loadBooks() {
		setLoading(true);
		setError("");

		try {
			const response = await fetch("/api/books");

			const data = await response.json();

			if (!response.ok) {
				throw new Error(
					typeof data?.error === "string"
						? data.error
						: "서재를 불러오지 못했습니다.",
				);
			}

			setBooks(data.data || []);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "서재를 불러오지 못했습니다.",
			);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadBooks();
	}, []);

	useEffect(() => {
		setCurrentPage(1);
		setPageInput("");
	}, [search, filter, activeTags, sortOption, managementFilter, viewMode]);

	useEffect(() => {
		function handleScroll() {
			setShowScrollTop(window.scrollY > 400);
		}

		window.addEventListener("scroll", handleScroll);

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;

			if (
				managementMenuRef.current &&
				!managementMenuRef.current.contains(target)
			) {
				setManagementMenuOpen(false);
			}

			const bookMenuTarget = (target as HTMLElement)?.closest?.(
				"[data-book-menu]",
			);

			if (!bookMenuTarget) {
				setOpenMenuId(null);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const filteredBooks = useMemo(() => {
		const keyword = search.trim().toLowerCase();

		return books.filter((book) => {
			if (managementFilter === "none" && book.is_excluded) {
				return false;
			}

			if (managementFilter === "reread" && !book.is_reread_wanted) {
				return false;
			}

			if (managementFilter === "excluded" && !book.is_excluded) {
				return false;
			}

			const matchesStatus =
				managementFilter !== "none" ||
				filter === "전체" ||
				getDisplayStatus(book) === filter;

			const activeCompletionTags = COMPLETION_TAGS.filter((tag) =>
				activeTags.has(tag),
			);

			const matchesCompletion =
				activeCompletionTags.length === 0 ||
				activeCompletionTags.some(
					(tag) =>
						(tag === "완결" && book.series_status === "completed") ||
						(tag === "미완" && book.series_status === "ongoing"),
				);

			const activeLengthTags = LENGTH_TAGS.filter((tag) => activeTags.has(tag));

			const matchesLength =
				activeLengthTags.length === 0 ||
				activeLengthTags.includes(getLengthBucket(book));

			const matchesSearch =
				keyword === "" || book.title.toLowerCase().includes(keyword);

			return (
				matchesStatus && matchesCompletion && matchesLength && matchesSearch
			);
		});
	}, [books, filter, activeTags, search, managementFilter]);

	const sortedBooks = useMemo(() => {
		const list = [...filteredBooks];

		if (sortOption === "episodes") {
			list.sort(
				(a, b) => getEffectiveTotalEpisodes(b) - getEffectiveTotalEpisodes(a),
			);
		} else if (sortOption === "title") {
			list.sort((a, b) => a.title.localeCompare(b.title, "ko"));
		}

		return list;
	}, [filteredBooks, sortOption]);

	const totalPages = Math.ceil(sortedBooks.length / itemsPerPage);

	useEffect(() => {
		setCurrentPage((page) => {
			const safeTotalPages = Math.max(1, totalPages);

			return page > safeTotalPages ? safeTotalPages : page;
		});
	}, [totalPages]);

	const paginatedBooks = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;

		return sortedBooks.slice(start, start + itemsPerPage);
	}, [sortedBooks, currentPage, itemsPerPage]);

	const pageNumbers = useMemo(() => {
		const start =
			Math.floor((currentPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;

		const end = Math.min(totalPages, start + PAGE_GROUP_SIZE - 1);

		return Array.from(
			{
				length: Math.max(0, end - start + 1),
			},
			(_, index) => start + index,
		);
	}, [currentPage, totalPages]);

	function changePage(page: number) {
		if (page < 1 || page > totalPages || page === currentPage) {
			return;
		}

		setCurrentPage(page);

		if (filter === "전체" && managementFilter === "none") {
			requestAnimationFrame(() => {
				allBooksSectionRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			});

			return;
		}

		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	}

	// 현재 페이지 그룹의 첫 페이지
	const currentPageGroupStart =
		Math.floor((currentPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;

	// 이전 페이지 그룹으로 이동
	function goToPreviousPageGroup() {
		const previousGroupStart = currentPageGroupStart - PAGE_GROUP_SIZE;

		changePage(Math.max(1, previousGroupStart));
	}

	// 다음 페이지 그룹으로 이동
	function goToNextPageGroup() {
		const nextGroupStart = currentPageGroupStart + PAGE_GROUP_SIZE;

		changePage(Math.min(totalPages, nextGroupStart));
	}

	// 입력한 페이지로 이동
	function goToInputPage() {
		const page = Number(pageInput);

		if (!Number.isInteger(page) || page < 1 || page > totalPages) {
			return;
		}

		changePage(page);
		setPageInput("");
	}

	const recentBooks = useMemo(() => {
		return [...books]
			.filter(
				(book) =>
					!book.is_excluded &&
					(book.status === "읽는 중" ||
						(book.progress > 0 && book.progress < 100)),
			)
			.sort(
				(a, b) =>
					new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
			)
			.slice(0, 3);
	}, [books]);

	function getReaderUrl(book: Book) {
		return `/drive?fileId=${encodeURIComponent(
			book.drive_file_id,
		)}&fileName=${encodeURIComponent(book.title)}`;
	}

	async function restartReading(book: Book) {
		if (book.status !== "완독") {
			return;
		}

		try {
			setError("");

			const response = await fetch("/api/books", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					drive_file_id: book.drive_file_id,
					title: book.title,
					total_episodes: book.total_episodes,
					restart: true,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(
					typeof data?.error === "string"
						? data.error
						: "다시 읽기를 시작하지 못했습니다.",
				);
			}

			window.location.href = getReaderUrl(book);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "다시 읽기를 시작하지 못했습니다.",
			);
		}
	}

	async function updateBookManagement(book: Book, type: "reread" | "excluded") {
		const isReread = Boolean(book.is_reread_wanted);

		const isExcluded = Boolean(book.is_excluded);

		let nextReread = isReread;

		let nextExcluded = isExcluded;

		if (type === "reread") {
			nextReread = !isReread;

			if (nextReread) {
				nextExcluded = false;
			}
		}

		if (type === "excluded") {
			nextExcluded = !isExcluded;

			if (nextExcluded) {
				nextReread = false;
			}
		}

		try {
			setError("");

			const response = await fetch("/api/books/manage", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					bookId: book.id,
					isRereadWanted: nextReread,
					isExcluded: nextExcluded,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(
					typeof data?.error === "string"
						? data.error
						: "작품 상태를 변경하지 못했습니다.",
				);
			}

			setBooks((prev) =>
				prev.map((item) =>
					item.id === book.id
						? {
								...item,
								is_reread_wanted: nextReread,
								is_excluded: nextExcluded,
							}
						: item,
				),
			);

			setOpenMenuId(null);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "작품 상태를 변경하지 못했습니다.",
			);
		}
	}

	function scrollToTop() {
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	}

	function getRound(book: Book) {
		return book.current_round ?? book.round_count ?? 1;
	}

	function getEpisode(book: Book) {
		if (
			book.current_episode !== null &&
			book.current_episode !== undefined &&
			book.current_episode > 0
		) {
			return book.current_episode;
		}

		if (book.last_episode > 0) {
			return book.last_episode;
		}

		return 1;
	}

	function getProgress(book: Book) {
		return book.current_progress ?? book.progress ?? 0;
	}

	function getDisplayStatus(book: Book) {
		if ((book.completed_round_count ?? 0) > 0) {
			return "완독";
		}

		return book.status;
	}

	function renderAction(
		book: Book,
		compact = false,
		variant: "default" | "light" = "default",
	) {
		const commonClass = compact
			? "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition"
			: "rounded-full px-5 py-2 text-sm font-semibold transition";

		const dark =
			variant === "light"
				? "bg-[#f5ecdc] text-[#2b2118] hover:bg-white"
				: "bg-stone-900 text-white hover:bg-stone-700";

		const accent =
			variant === "light"
				? "bg-[#f5ecdc] text-[#2b2118] hover:bg-white"
				: "bg-[#8a3a3a] text-white hover:bg-[#702e2e]";

		if (book.status === "완독") {
			return (
				<button
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						restartReading(book);
					}}
					className={`${commonClass} ${dark}`}
				>
					다시 읽기
				</button>
			);
		}

		if (book.status === "안 읽음") {
			return (
				<Link
					href={getReaderUrl(book)}
					onClick={(event) => event.stopPropagation()}
					className={`${commonClass} ${dark}`}
				>
					읽기 시작
				</Link>
			);
		}

		return (
			<Link
				href={getReaderUrl(book)}
				onClick={(event) => event.stopPropagation()}
				className={`${commonClass} ${accent}`}
			>
				이어읽기
			</Link>
		);
	}

	function renderBookMenu(
		book: Book,
		tone: "default" | "overlay" | "dark" = "default",
		align: "left" | "right" = "right",
	) {
		const isOpen = openMenuId === book.id;
		const itemClass =
			"flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-100";

		const buttonClass =
			tone === "overlay"
				? "h-7 w-7 bg-black/35 text-white backdrop-blur hover:bg-black/55"
				: tone === "dark"
					? "h-8 w-8 text-[#f5ecdc]/70 hover:bg-white/10 hover:text-white"
					: "h-8 w-8 text-stone-400 hover:bg-stone-100 hover:text-stone-700";

		return (
			<div
				data-book-menu
				className={`absolute z-30 ${
					tone === "overlay" ? "right-1 top-1" : "right-2 top-2"
				}`}
			>
				<button
					type="button"
					aria-label="소설 관리"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setOpenMenuId(isOpen ? null : book.id);
					}}
					className={`flex items-center justify-center rounded-full transition ${buttonClass}`}
				>
					<MoreVertical className="h-4 w-4" strokeWidth={2} />
				</button>

				{isOpen && (
					<div
						className={`absolute top-9 w-44 rounded-xl border border-stone-200 bg-white p-1 text-stone-700 shadow-xl ${
							align === "left" ? "left-0" : "right-0"
						}`}
					>
						<a
							href={getGoogleSearchUrl(book.title)}
							target="_blank"
							rel="noopener noreferrer"
							onClick={(event) => {
								event.stopPropagation();
								setOpenMenuId(null);
							}}
							className={itemClass}
						>
							<Search className="h-4 w-4 text-stone-400" strokeWidth={1.75} />
							구글에서 검색
						</a>

						<div className="my-1 border-t border-stone-100" />

						<button
							type="button"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								updateBookManagement(book, "reread");
							}}
							className={itemClass}
						>
							{book.is_reread_wanted ? "다시 볼 작품 해제" : "다시 볼 작품"}
						</button>

						<button
							type="button"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								updateBookManagement(book, "excluded");
							}}
							className={itemClass}
						>
							{book.is_excluded ? "제외 해제" : "제외하기"}
						</button>
					</div>
				)}
			</div>
		);
	}

	// 표지 중심 타일 (격자 보기, 최근 읽은 소설)
	function renderTile(book: Book, align: "left" | "right" = "right") {
		const status = getDisplayStatus(book);

		const inner = (
			<>
				<BookCover
					title={book.title}
					className="aspect-[2/3] w-full"
					textClass="text-[11px] sm:text-xs"
				/>
				<p className="mt-2.5 line-clamp-2 text-xs font-semibold leading-4 text-stone-800">
					{book.title}
				</p>
				<div className="mt-1.5">
					<ProgressBar percent={getProgress(book)} status={status} />
				</div>
				<p className="mt-1 flex items-center gap-1 text-[10px] text-stone-400">
					<span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
					{status === "완독"
						? "완독 · 탭해서 다시 읽기"
						: `${status} · ${getProgress(book)}%`}
				</p>
			</>
		);

		return (
			<div key={book.id} className="relative">
				{renderBookMenu(book, "overlay", align)}

				{book.status === "완독" ? (
					<button
						type="button"
						onClick={() => restartReading(book)}
						className="block w-full text-left"
					>
						{inner}
					</button>
				) : (
					<Link href={getReaderUrl(book)} className="block">
						{inner}
					</Link>
				)}
			</div>
		);
	}

	// 책장 한 줄 (목록 보기)
	function renderRow(book: Book) {
		const status = getDisplayStatus(book);

		return (
			<div
				key={book.id}
				className="relative flex gap-3.5 px-4 py-4 sm:gap-4 sm:px-5"
			>
				{renderBookMenu(book)}

				<BookCover
					title={book.title}
					className="h-[88px] w-[60px] sm:h-24 sm:w-16"
					textClass="text-[9px] sm:text-[10px]"
				/>

				<div className="flex min-w-0 flex-1 flex-col pr-6">
					<h4 className="line-clamp-2 text-[15px] font-semibold leading-5 text-stone-900">
						{book.title}
					</h4>

					<p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500">
						<span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
						{status}
						<span className="text-stone-300">·</span>
						{book.series_status === "completed" ? "완결" : "연재중"}
						<span className="text-stone-300">·</span>
						{getRound(book)}회독 {getEpisode(book)}화
					</p>

					<div className="mt-auto flex items-center gap-3 pt-2.5">
						<div className="flex-1">
							<ProgressBar percent={getProgress(book)} status={status} />
						</div>
						<span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-stone-500">
							{getProgress(book)}%
						</span>
						{renderAction(book, true)}
					</div>
				</div>
			</div>
		);
	}

	function getSectionTitle() {
		if (managementFilter === "reread") {
			return "다시 볼 작품";
		}

		if (managementFilter === "excluded") {
			return "제외한 작품";
		}

		return "전체 소설";
	}

	function getEmptyMessage() {
		if (managementFilter === "reread") {
			return search.trim()
				? "검색 결과가 없습니다."
				: "다시 볼 작품이 없습니다.";
		}

		if (managementFilter === "excluded") {
			return search.trim()
				? "검색 결과가 없습니다."
				: "제외한 작품이 없습니다.";
		}

		return search.trim() ? "검색 결과가 없습니다." : "표시할 소설이 없습니다.";
	}

	return (
		<main className="min-h-screen bg-[#faf6ef] text-stone-900">
			<header className="sticky top-0 z-10 border-b border-stone-200/70 bg-[#faf6ef]/85 backdrop-blur-md">
				<div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:px-6">
					<div className="flex items-center gap-2">
						<BookOpen
							className="h-[18px] w-[18px] text-[#8a3a3a]"
							strokeWidth={2}
						/>
						<h1 className="font-serif text-lg font-bold tracking-tight">
							Reader
						</h1>
					</div>

					<LogoutButton />
				</div>
			</header>

			<section className="mx-auto max-w-3xl px-5 pb-28 pt-6 sm:px-6 sm:pt-8">
				<div>
					<h2 className="font-serif text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">
						내 서재
					</h2>
					<p className="mt-1 text-sm text-stone-500">
						내가 읽고 있는 웹소설을 관리하세요.
					</p>
				</div>

				{error && (
					<div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
						{error}
					</div>
				)}

				<div className="mt-5 flex items-center border-b border-stone-300/60">
					{["전체", "읽는 중", "완독", "안 읽음"].map((item) => {
						const active = managementFilter === "none" && filter === item;

						return (
							<button
								key={item}
								type="button"
								onClick={() => {
									setManagementFilter("none");
									setFilter(item);
									setManagementMenuOpen(false);
								}}
								className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition sm:px-4 ${
									active
										? "border-[#8a3a3a] text-stone-900"
										: "border-transparent text-stone-400 hover:text-stone-700"
								}`}
							>
								{item}
							</button>
						);
					})}

					<div ref={managementMenuRef} className="relative ml-auto shrink-0">
						<button
							type="button"
							onClick={() => setManagementMenuOpen((prev) => !prev)}
							className={`-mb-px flex items-center gap-1 border-b-2 px-2 pb-2.5 pt-1 text-sm font-semibold transition ${
								managementFilter !== "none"
									? "border-[#8a3a3a] text-[#8a3a3a]"
									: "border-transparent text-stone-400 hover:text-stone-700"
							}`}
						>
							관리함
							<ChevronDown
								className={`h-3.5 w-3.5 transition-transform ${
									managementMenuOpen ? "rotate-180" : ""
								}`}
								strokeWidth={2}
							/>
						</button>

						{managementMenuOpen && (
							<div className="absolute right-0 top-10 z-40 w-40 rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
								{(
									[
										["reread", "다시 볼 작품"],
										["excluded", "제외한 작품"],
									] as const
								).map(([key, label]) => (
									<button
										key={key}
										type="button"
										onClick={() => {
											setManagementFilter(key);
											setFilter("전체");
											setManagementMenuOpen(false);
										}}
										className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
											managementFilter === key
												? "bg-[#8a3a3a]/10 text-[#8a3a3a]"
												: "text-stone-700 hover:bg-stone-100"
										}`}
									>
										{label}
									</button>
								))}

								{managementFilter !== "none" && (
									<>
										<div className="my-1 border-t border-stone-100" />
										<button
											type="button"
											onClick={() => {
												setManagementFilter("none");
												setFilter("전체");
												setManagementMenuOpen(false);
											}}
											className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-500 transition hover:bg-stone-100"
										>
											일반 목록
										</button>
									</>
								)}
							</div>
						)}
					</div>
				</div>

				{filter === "전체" && managementFilter === "none" && (
					<section className="mt-6">
						{loading ? (
							<div className="rounded-3xl bg-stone-200/50 px-5 py-14 text-center text-sm text-stone-400">
								서재를 불러오는 중...
							</div>
						) : recentBooks.length === 0 ? (
							<div className="rounded-3xl border border-dashed border-stone-300 px-5 py-10 text-center text-sm text-stone-400">
								최근 읽은 소설이 없습니다.
							</div>
						) : (
							<>
								<div className="relative overflow-hidden rounded-3xl bg-[#2b2118] p-4 text-[#f5ecdc] shadow-lg sm:p-5">
									{renderBookMenu(recentBooks[0], "dark")}

									<p className="text-[11px] font-semibold tracking-[0.2em] text-[#e3b27a]">
										이어 읽기
									</p>

									<div className="mt-3 flex gap-4">
										<BookCover
											title={recentBooks[0].title}
											className="h-36 w-24 sm:h-40 sm:w-28"
											textClass="text-xs"
										/>

										<div className="flex min-w-0 flex-1 flex-col">
											<h3 className="line-clamp-2 pr-8 font-serif text-lg font-semibold leading-snug">
												{recentBooks[0].title}
											</h3>

											<p className="mt-1 text-xs text-[#f5ecdc]/60">
												{getRound(recentBooks[0])}회독 ·{" "}
												{getEpisode(recentBooks[0])}화 /{" "}
												{getEffectiveTotalEpisodes(recentBooks[0])}화
											</p>

											<div className="mt-auto pt-4">
												<div className="flex items-center gap-2.5">
													<ProgressBar
														dark
														percent={getProgress(recentBooks[0])}
														status={getDisplayStatus(recentBooks[0])}
													/>
													<span className="shrink-0 text-xs font-semibold tabular-nums text-[#e3b27a]">
														{getProgress(recentBooks[0])}%
													</span>
												</div>

												<div className="mt-3">
													{renderAction(recentBooks[0], false, "light")}
												</div>
											</div>
										</div>
									</div>
								</div>

								{recentBooks.length > 1 && (
									<div className="mt-6">
										<h3 className="font-serif text-base font-bold">
											최근 읽은 소설
										</h3>

										<div className="-mx-5 mt-3 flex snap-x gap-4 overflow-x-auto px-5 pb-3 sm:mx-0 sm:px-0">
											{recentBooks.slice(1).map((book) => (
												<div
													key={book.id}
													className="w-28 shrink-0 snap-start sm:w-32"
												>
													{renderTile(book)}
												</div>
											))}
										</div>
									</div>
								)}
							</>
						)}
					</section>
				)}

				<section ref={allBooksSectionRef} className="mt-8">
					<div className="flex items-center justify-between">
						<h3 className="font-serif text-lg font-bold">
							{getSectionTitle()}
							<span className="ml-2 font-sans text-sm font-normal text-stone-400">
								{sortedBooks.length.toLocaleString("ko-KR")}
							</span>
						</h3>

						<div className="flex items-center gap-2">
							<div className="flex rounded-full bg-stone-200/70 p-0.5">
								{(
									[
										{ mode: "list", Icon: List, label: "목록 보기" },
										{ mode: "grid", Icon: LayoutGrid, label: "표지 보기" },
									] as const
								).map(({ mode, Icon, label }) => (
									<button
										key={mode}
										type="button"
										aria-label={label}
										onClick={() => changeViewMode(mode)}
										className={`flex h-7 w-8 items-center justify-center rounded-full transition ${
											viewMode === mode
												? "bg-white text-stone-900 shadow-sm"
												: "text-stone-400 hover:text-stone-700"
										}`}
									>
										<Icon className="h-4 w-4" strokeWidth={1.75} />
									</button>
								))}
							</div>

							<button
								type="button"
								disabled={syncing}
								aria-label="새로고침"
								onClick={async () => {
									setSyncing(true);
									setError("");

									try {
										const response = await fetch("/api/books/sync");
										const data = await response.json();

										if (!response.ok) {
											throw new Error(
												typeof data?.error === "string"
													? data.error
													: "동기화에 실패했습니다.",
											);
										}

										await loadBooks();
									} catch (error) {
										setError(
											error instanceof Error
												? error.message
												: "동기화 중 오류가 발생했습니다.",
										);
									} finally {
										setSyncing(false);
									}
								}}
								className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200/70 text-stone-500 transition hover:text-stone-900 disabled:opacity-50"
							>
								<RotateCcw
									className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
									strokeWidth={1.75}
								/>
							</button>
						</div>
					</div>

					<div className="relative mt-4">
						<Search
							className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
							strokeWidth={1.75}
						/>

						<input
							type="text"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="소설 제목 검색"
							className="h-11 w-full rounded-full border border-stone-200 bg-white pl-10 pr-10 text-sm outline-none transition placeholder:text-stone-400 focus:border-[#8a3a3a]/50 focus:ring-4 focus:ring-[#8a3a3a]/10"
						/>

						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								aria-label="검색어 지우기"
								className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
							>
								<X className="h-3.5 w-3.5" strokeWidth={2} />
							</button>
						)}
					</div>

					<div className="-mx-5 mt-3 flex items-center gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
						{(
							[
								{ key: "default", label: "기본순" },
								{ key: "episodes", label: "화수 많은순" },
								{ key: "title", label: "가나다순" },
							] as const
						).map((opt) => (
							<button
								key={opt.key}
								type="button"
								onClick={() => changeSortOption(opt.key)}
								className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
									sortOption === opt.key
										? "bg-stone-900 text-white"
										: "bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50"
								}`}
							>
								{opt.label}
							</button>
						))}

						{managementFilter === "none" && (
							<button
								type="button"
								onClick={() => setTagFilterOpen((prev) => !prev)}
								className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
									activeTags.size > 0
										? "bg-[#8a3a3a]/10 text-[#8a3a3a] ring-1 ring-[#8a3a3a]/40"
										: tagFilterOpen
											? "bg-stone-900 text-white"
											: "bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50"
								}`}
							>
								<Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
								필터
								{activeTags.size > 0 && (
									<span className="ml-0.5">{activeTags.size}</span>
								)}
								<ChevronDown
									className={`h-3.5 w-3.5 transition-transform ${
										tagFilterOpen ? "rotate-180" : ""
									}`}
									strokeWidth={1.75}
								/>
							</button>
						)}
					</div>

					{managementFilter === "none" && tagFilterOpen && (
						<div className="mt-2 flex flex-wrap items-center gap-2">
							{TOGGLE_TAGS.map((tag) => {
								const isActive = activeTags.has(tag);

								return (
									<button
										key={tag}
										type="button"
										onClick={() => toggleTag(tag)}
										className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
											isActive
												? "bg-[#8a3a3a]/10 text-[#8a3a3a] ring-1 ring-[#8a3a3a]/40"
												: "bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50"
										}`}
									>
										{tag}
									</button>
								);
							})}

							<button
								type="button"
								onClick={resetTags}
								disabled={activeTags.size === 0}
								className="ml-1 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-stone-400 ring-1 ring-stone-200 transition hover:bg-stone-50 hover:text-stone-600 disabled:cursor-default disabled:opacity-40"
							>
								초기화
							</button>
						</div>
					)}

					{loading ? (
						<div className="mt-4 rounded-2xl bg-stone-200/50 px-5 py-12 text-center text-sm text-stone-400">
							불러오는 중...
						</div>
					) : filteredBooks.length === 0 ? (
						<div className="mt-4 rounded-2xl border border-dashed border-stone-300 px-5 py-12 text-center text-sm text-stone-400">
							{getEmptyMessage()}
						</div>
					) : (
						<>
							{viewMode === "list" ? (
								<div className="mt-4 divide-y divide-stone-200/70 rounded-2xl border border-stone-200/70 bg-white/60">
									{paginatedBooks.map((book) => renderRow(book))}
								</div>
							) : (
								<div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
									{paginatedBooks.map((book, index) =>
										renderTile(book, index % 3 === 0 ? "left" : "right"),
									)}
								</div>
							)}

							{/* 페이지네이션 */}
							{totalPages > 1 && (
								<div className="mt-7 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
									<button
										type="button"
										onClick={goToPreviousPageGroup}
										disabled={currentPageGroupStart === 1}
										className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-600 ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:cursor-default disabled:opacity-30 sm:text-sm"
									>
										이전
									</button>

									{pageNumbers.map((page) => (
										<button
											key={page}
											type="button"
											onClick={() => changePage(page)}
											className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold transition sm:h-9 sm:min-w-9 sm:text-sm ${
												currentPage === page
													? "bg-stone-900 text-white"
													: "bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50"
											}`}
										>
											{page}
										</button>
									))}

									<button
										type="button"
										onClick={goToNextPageGroup}
										disabled={
											currentPageGroupStart + PAGE_GROUP_SIZE > totalPages
										}
										className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-600 ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:cursor-default disabled:opacity-30 sm:text-sm"
									>
										다음
									</button>

									{/* 페이지 직접 입력 */}
									<div className="ml-2 flex items-center gap-1.5">
										<input
											type="number"
											min={1}
											max={totalPages}
											value={pageInput}
											onChange={(event) => setPageInput(event.target.value)}
											onKeyDown={(event) => {
												if (event.key === "Enter") {
													goToInputPage();
												}
											}}
											placeholder={`${currentPage}`}
											aria-label="이동할 페이지"
											className="h-8 w-14 rounded-full border border-stone-200 bg-white px-2 text-center text-xs outline-none transition focus:border-[#8a3a3a]/50 focus:ring-4 focus:ring-[#8a3a3a]/10 sm:h-9 sm:w-16 sm:text-sm"
										/>

										<span className="whitespace-nowrap text-xs text-stone-400 sm:text-sm">
											/ {totalPages}
										</span>
									</div>
								</div>
							)}
						</>
					)}
				</section>
			</section>

			{showScrollTop && (
				<button
					type="button"
					onClick={scrollToTop}
					aria-label="맨 위로"
					className="fixed bottom-20 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-600 shadow-lg ring-1 ring-stone-200 transition hover:text-stone-900 sm:bottom-24 sm:right-8 sm:h-11 sm:w-11"
				>
					<ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} />
				</button>
			)}
		</main>
	);
}
