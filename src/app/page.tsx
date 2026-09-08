"use client";

import Link from "next/link";
import {
	startTransition,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	BookOpen,
	RotateCcw,
	ArrowUp,
	Search,
	X,
	MoreVertical,
	ChevronRight,
	ChevronDown,
	Filter,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

type Book = {
	id: string;
	user_id: string;
	drive_file_id: string;
	title: string;
	total_episodes: number;
	last_episode: number;
	progress: number;
	status: "읽는 중" | "완독" | "안 읽음";
	created_at: string;
	updated_at: string;
	series_status: "ongoing" | "completed";
	round_count?: number;
	completed_round_count?: number;
	current_round?: number | null;
	current_round_id?: string | null;
	current_episode?: number | null;
	current_progress?: number | null;
	current_scroll_position?: number | null;

	// 작품 관리
	is_reread_wanted?: boolean;
	is_excluded?: boolean;
};

const statusStyle: Record<string, string> = {
	"읽는 중": "bg-blue-50 text-blue-700",
	완독: "bg-green-50 text-green-700",
	"안 읽음": "bg-gray-100 text-gray-500",
};

const progressRingColor: Record<string, string> = {
	"읽는 중": "text-blue-600",
	완독: "text-green-600",
	"안 읽음": "text-gray-300",
};

function ProgressRing({
	percent,
	status,
	size = 40,
}: {
	percent: number;
	status: string;
	size?: number;
}) {
	const radius = (size - 6) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset =
		circumference -
		(Math.min(100, Math.max(0, percent)) / 100) *
			circumference;

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className="-rotate-90 shrink-0"
		>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				strokeWidth="3"
				className="fill-none stroke-gray-100"
			/>

			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				strokeWidth="3"
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				strokeLinecap="round"
				className={`fill-none stroke-current transition-all ${
					progressRingColor[status] ||
					"text-gray-300"
				}`}
			/>
		</svg>
	);
}

function getTitleEpisodeCount(
	title: string
): number {
	const matches = [
		...title.matchAll(
			/(\d+)\s*[-~]\s*(\d+)/g
		),
	];

	if (matches.length === 0) {
		return 0;
	}

	const last =
		matches[matches.length - 1];

	const count = parseInt(
		last[2],
		10
	);

	return Number.isFinite(count)
		? count
		: 0;
}

function getEffectiveTotalEpisodes(
	book: Book
): number {
	return Math.max(
		book.total_episodes || 0,
		getTitleEpisodeCount(book.title)
	);
}

const TOGGLE_TAGS = [
	"완결",
	"미완",
	"단편",
	"중편",
	"장편",
] as const;

type ToggleTag =
	(typeof TOGGLE_TAGS)[number];

const COMPLETION_TAGS: ToggleTag[] = [
	"완결",
	"미완",
];

const LENGTH_TAGS: ToggleTag[] = [
	"단편",
	"중편",
	"장편",
];

function getLengthBucket(
	book: Book
): "단편" | "중편" | "장편" {
	const total =
		getEffectiveTotalEpisodes(book);

	if (total > 1000) {
		return "장편";
	}

	if (total >= 500) {
		return "중편";
	}

	return "단편";
}

const ITEMS_PER_PAGE = 20;

type ManagementFilter =
	| "none"
	| "reread"
	| "excluded";

export default function Home() {
	const [books, setBooks] =
		useState<Book[]>([]);

	const [loading, setLoading] =
		useState(true);

	const [error, setError] =
		useState("");

	const [filter, setFilter] =
		useState("전체");

	const [activeTags, setActiveTags] =
		useState<Set<ToggleTag>>(
			() => new Set()
		);

	const [sortOption, setSortOption] =
		useState<
			"default" | "episodes" | "title"
		>("default");

	const [search, setSearch] =
		useState("");

	const [
		showScrollTop,
		setShowScrollTop,
	] = useState(false);

	const [syncing, setSyncing] =
		useState(false);

	// 페이지네이션
	const [
		currentPage,
		setCurrentPage,
	] = useState(1);

	// 작품 관리 메뉴
	const [
		openMenuId,
		setOpenMenuId,
	] = useState<string | null>(null);

	// 관리함
	const [
		managementFilter,
		setManagementFilter,
	] = useState<ManagementFilter>(
		"none"
	);

	const [
		managementMenuOpen,
		setManagementMenuOpen,
	] = useState(false);

	// 완결/미완/단편 등 태그 필터 열림 여부
	const [
		tagFilterOpen,
		setTagFilterOpen,
	] = useState(false);

	// 전체 소설 영역 위치
	const allBooksSectionRef =
		useRef<HTMLElement>(null);

	const managementMenuRef =
		useRef<HTMLDivElement>(null);

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

	function changeSortOption(
		option:
			| "default"
			| "episodes"
			| "title"
	) {
		startTransition(() => {
			setSortOption(option);
		});
	}

	async function loadBooks() {
		setLoading(true);
		setError("");

		try {
			const response =
				await fetch("/api/books");

			const data =
				await response.json();

			if (!response.ok) {
				throw new Error(
					typeof data?.error ===
						"string"
						? data.error
						: "서재를 불러오지 못했습니다."
				);
			}

			setBooks(data.data || []);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "서재를 불러오지 못했습니다."
			);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadBooks();
	}, []);

	// 검색 / 필터 / 태그 / 정렬 / 관리함이 변경되면 1페이지로 이동
	useEffect(() => {
		setCurrentPage(1);
	}, [
		search,
		filter,
		activeTags,
		sortOption,
		managementFilter,
	]);

	// 페이지 전체 스크롤에 따른 맨 위로 버튼
	useEffect(() => {
		function handleScroll() {
			setShowScrollTop(
				window.scrollY > 400
			);
		}

		window.addEventListener(
			"scroll",
			handleScroll
		);

		return () => {
			window.removeEventListener(
				"scroll",
				handleScroll
			);
		};
	}, []);

	// 메뉴 바깥을 클릭하면 닫기
	useEffect(() => {
		function handleClickOutside(
			event: MouseEvent
		) {
			const target =
				event.target as Node;

			if (
				managementMenuRef.current &&
				!managementMenuRef.current.contains(
					target
				)
			) {
				setManagementMenuOpen(false);
			}

			const bookMenuTarget =
				(
					target as HTMLElement
				)?.closest?.(
					"[data-book-menu]"
				);

			if (!bookMenuTarget) {
				setOpenMenuId(null);
			}
		}

		document.addEventListener(
			"mousedown",
			handleClickOutside
		);

		return () => {
			document.removeEventListener(
				"mousedown",
				handleClickOutside
			);
		};
	}, []);

	const filteredBooks = useMemo(() => {
		const keyword =
			search
				.trim()
				.toLowerCase();

		return books.filter((book) => {
			// 제외된 작품은 일반 목록에서 숨김
			if (
				managementFilter ===
					"none" &&
				book.is_excluded
			) {
				return false;
			}

			// 관리함 - 다시 볼 작품
			if (
				managementFilter ===
					"reread" &&
				!book.is_reread_wanted
			) {
				return false;
			}

			// 관리함 - 제외한 작품
			if (
				managementFilter ===
					"excluded" &&
				!book.is_excluded
			) {
				return false;
			}

			// 관리함을 보고 있을 때는 기존 상태 필터를 적용하지 않음
			const matchesStatus =
				managementFilter !==
					"none" ||
				filter === "전체" ||
				getDisplayStatus(book) ===
					filter;

			const activeCompletionTags =
				COMPLETION_TAGS.filter(
					(tag) =>
						activeTags.has(tag)
				);

			const matchesCompletion =
				activeCompletionTags.length ===
					0 ||
				activeCompletionTags.some(
					(tag) =>
						(tag === "완결" &&
							book.series_status ===
								"completed") ||
						(tag === "미완" &&
							book.series_status ===
								"ongoing")
				);

			const activeLengthTags =
				LENGTH_TAGS.filter(
					(tag) =>
						activeTags.has(tag)
				);

			const matchesLength =
				activeLengthTags.length ===
					0 ||
				activeLengthTags.includes(
					getLengthBucket(book)
				);

			const matchesSearch =
				keyword === "" ||
				book.title
					.toLowerCase()
					.includes(keyword);

			return (
				matchesStatus &&
				matchesCompletion &&
				matchesLength &&
				matchesSearch
			);
		});
	}, [
		books,
		filter,
		activeTags,
		search,
		managementFilter,
	]);

	const sortedBooks = useMemo(() => {
		const list = [
			...filteredBooks,
		];

		if (
			sortOption === "episodes"
		) {
			list.sort(
				(a, b) =>
					getEffectiveTotalEpisodes(
						b
					) -
					getEffectiveTotalEpisodes(
						a
					)
			);
		} else if (
			sortOption === "title"
		) {
			list.sort((a, b) =>
				a.title.localeCompare(
					b.title,
					"ko"
				)
			);
		}

		return list;
	}, [
		filteredBooks,
		sortOption,
	]);

	// 전체 페이지 수
	const totalPages = Math.ceil(
		sortedBooks.length /
			ITEMS_PER_PAGE
	);

	// 현재 페이지가 필터 결과의 마지막 페이지보다 커진 경우에만 보정
	useEffect(() => {
		setCurrentPage((page) => {
			const safeTotalPages =
				Math.max(
					1,
					totalPages
				);

			return page >
				safeTotalPages
				? safeTotalPages
				: page;
		});
	}, [totalPages]);

	// 현재 페이지에 표시할 소설
	const paginatedBooks = useMemo(() => {
		const start =
			(currentPage - 1) *
			ITEMS_PER_PAGE;

		return sortedBooks.slice(
			start,
			start + ITEMS_PER_PAGE
		);
	}, [
		sortedBooks,
		currentPage,
	]);

	// 페이지 번호는 현재 페이지 주변만 표시
	const pageNumbers = useMemo(() => {
		if (totalPages <= 5) {
			return Array.from(
				{
					length: totalPages,
				},
				(_, index) =>
					index + 1
			);
		}

		let start = Math.max(
			1,
			currentPage - 2
		);

		let end = Math.min(
			totalPages,
			start + 4
		);

		if (end - start < 4) {
			start = Math.max(
				1,
				end - 4
			);
		}

		return Array.from(
			{
				length:
					end - start + 1,
			},
			(_, index) =>
				start + index
		);
	}, [
		currentPage,
		totalPages,
	]);

	function changePage(
		page: number
	) {
		if (
			page < 1 ||
			page > totalPages ||
			page === currentPage
		) {
			return;
		}

		setCurrentPage(page);

		// 전체 탭에서는 최근 읽은 소설을 지나
		// 전체 소설 영역의 시작 부분까지만 이동
		if (
			filter === "전체" &&
			managementFilter === "none"
		) {
			requestAnimationFrame(() => {
				allBooksSectionRef.current?.scrollIntoView(
					{
						behavior:
							"smooth",
						block: "start",
					}
				);
			});

			return;
		}

		// 그 외 상태 탭 / 관리함에서는 화면 맨 위로 이동
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	}

	const recentBooks = useMemo(() => {
		return [...books]
			.filter(
				(book) =>
					!book.is_excluded &&
					(book.status ===
						"읽는 중" ||
						(book.progress > 0 &&
							book.progress <
								100))
			)
			.sort(
				(a, b) =>
					new Date(
						b.updated_at
					).getTime() -
					new Date(
						a.updated_at
					).getTime()
			)
			.slice(0, 3);
	}, [books]);

	function getReaderUrl(
		book: Book
	) {
		return `/drive?fileId=${encodeURIComponent(
			book.drive_file_id
		)}&fileName=${encodeURIComponent(
			book.title
		)}`;
	}

	async function restartReading(
		book: Book
	) {
		if (book.status !== "완독") {
			return;
		}

		try {
			setError("");

			const response =
				await fetch("/api/books", {
					method: "POST",
					headers: {
						"Content-Type":
							"application/json",
					},
					body: JSON.stringify({
						drive_file_id:
							book.drive_file_id,
						title: book.title,
						total_episodes:
							book.total_episodes,
						restart: true,
					}),
				});

			const data =
				await response.json();

			if (!response.ok) {
				throw new Error(
					typeof data?.error ===
						"string"
						? data.error
						: "다시 읽기를 시작하지 못했습니다."
				);
			}

			window.location.href =
				getReaderUrl(book);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "다시 읽기를 시작하지 못했습니다."
			);
		}
	}

	// 작품 관리 상태 변경
	async function updateBookManagement(
		book: Book,
		type:
			| "reread"
			| "excluded"
	) {
		const isReread =
			Boolean(
				book.is_reread_wanted
			);

		const isExcluded =
			Boolean(
				book.is_excluded
			);

		let nextReread =
			isReread;

		let nextExcluded =
			isExcluded;

		if (type === "reread") {
			nextReread =
				!isReread;

			// 다시 볼 작품으로 지정하면
			// 제외 상태는 해제
			if (nextReread) {
				nextExcluded =
					false;
			}
		}

		if (type === "excluded") {
			nextExcluded =
				!isExcluded;

			// 제외하기로 지정하면
			// 다시 볼 작품 상태는 해제
			if (nextExcluded) {
				nextReread =
					false;
			}
		}

		try {
			setError("");

			const response =
				await fetch(
					"/api/books/manage",
					{
						method: "PATCH",
						headers: {
							"Content-Type":
								"application/json",
						},
						body: JSON.stringify({
							bookId: book.id,
							isRereadWanted:
								nextReread,
							isExcluded:
								nextExcluded,
						}),
					}
				);

			const data =
				await response.json();

			if (!response.ok) {
				throw new Error(
					typeof data?.error ===
						"string"
						? data.error
						: "작품 상태를 변경하지 못했습니다."
				);
			}

			setBooks((prev) =>
				prev.map((item) =>
					item.id === book.id
						? {
								...item,
								is_reread_wanted:
									nextReread,
								is_excluded:
									nextExcluded,
							}
						: item
				)
			);

			setOpenMenuId(null);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "작품 상태를 변경하지 못했습니다."
			);
		}
	}

	function scrollToTop() {
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	}

	function getRound(
		book: Book
	) {
		return (
			book.current_round ??
			book.round_count ??
			1
		);
	}

	function getEpisode(
		book: Book
	) {
		if (
			book.current_episode !==
				null &&
			book.current_episode !==
				undefined &&
			book.current_episode > 0
		) {
			return book.current_episode;
		}

		if (
			book.last_episode > 0
		) {
			return book.last_episode;
		}

		return 1;
	}

	function getProgress(
		book: Book
	) {
		return (
			book.current_progress ??
			book.progress ??
			0
		);
	}

	function getDisplayStatus(
		book: Book
	) {
		if (
			(book.completed_round_count ??
				0) > 0
		) {
			return "완독";
		}

		return book.status;
	}

	function renderAction(
		book: Book,
		compact = false
	) {
		const commonClass =
			compact
				? "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm"
				: "rounded-lg px-2.5 py-1.5 text-xs font-medium transition";

		if (
			book.status === "완독"
		) {
			return (
				<button
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						restartReading(book);
					}}
					className={`${commonClass} bg-gray-900 text-white hover:bg-gray-800`}
				>
					다시 읽기
				</button>
			);
		}

		if (
			book.status === "안 읽음"
		) {
			return (
				<Link
					href={getReaderUrl(
						book
					)}
					onClick={(event) =>
						event.stopPropagation()
					}
					className={`${commonClass} bg-gray-900 text-white hover:bg-gray-800`}
				>
					읽기 시작
				</Link>
			);
		}

		return (
			<Link
				href={getReaderUrl(
					book
				)}
				onClick={(event) =>
					event.stopPropagation()
				}
				className={`${commonClass} bg-blue-600 text-white hover:bg-blue-700`}
			>
				이어읽기
			</Link>
		);
	}

	function renderBookMenu(
		book: Book
	) {
		const isOpen =
			openMenuId === book.id;

		return (
			<div
				data-book-menu
				className="absolute right-2 top-2 z-30"
			>
				<button
					type="button"
					aria-label="소설 관리"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();

						setOpenMenuId(
							isOpen
								? null
								: book.id
						);
					}}
					className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
				>
					<MoreVertical
						className="h-4 w-4"
						strokeWidth={2}
					/>
				</button>

				{isOpen && (
					<div className="absolute right-0 top-9 w-36 rounded-xl border bg-white p-1 shadow-lg">
						<button
							type="button"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();

								updateBookManagement(
									book,
									"reread"
								);
							}}
							className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-100 sm:text-sm"
						>
							{book.is_reread_wanted
								? "다시 볼 작품 해제"
								: "다시 볼 작품"}
						</button>

						<button
							type="button"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();

								updateBookManagement(
									book,
									"excluded"
								);
							}}
							className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-100 sm:text-sm"
						>
							{book.is_excluded
								? "제외 해제"
								: "제외하기"}
						</button>
					</div>
				)}
			</div>
		);
	}

	function getSectionTitle() {
		if (
			managementFilter ===
			"reread"
		) {
			return "다시 볼 작품";
		}

		if (
			managementFilter ===
			"excluded"
		) {
			return "제외한 작품";
		}

		return "전체 소설";
	}

	function getEmptyMessage() {
		if (
			managementFilter ===
			"reread"
		) {
			return search.trim()
				? "검색 결과가 없습니다."
				: "다시 볼 작품이 없습니다.";
		}

		if (
			managementFilter ===
			"excluded"
		) {
			return search.trim()
				? "검색 결과가 없습니다."
				: "제외한 작품이 없습니다.";
		}

		return search.trim()
			? "검색 결과가 없습니다."
			: "표시할 소설이 없습니다.";
	}

	return (
		<main className="min-h-screen bg-gray-50 text-gray-900">
			<header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
					<div className="flex items-center gap-2">
						<BookOpen
							className="h-4 w-4 text-gray-900"
							strokeWidth={1.75}
						/>

						<h1 className="text-base font-semibold">
							Reader
						</h1>
					</div>

					<LogoutButton />
				</div>
			</header>

			<section className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-6 sm:pb-28 sm:pt-10">
				<div>
					<h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
						내 서재
					</h2>

					<p className="mt-1.5 text-sm text-gray-500 sm:text-base">
						내가 읽고 있는 웹소설을 관리하세요.
					</p>
				</div>

				{error && (
					<div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
						{error}
					</div>
				)}

				{/* 상태 필터 */}
				<div className="mt-5 flex gap-1.5 sm:mt-6 sm:gap-2">
					{[
						"전체",
						"읽는 중",
						"완독",
						"안 읽음",
					].map((item) => (
						<button
							key={item}
							type="button"
							onClick={() => {
								setManagementFilter(
									"none"
								);
								setFilter(
									item
								);
								setManagementMenuOpen(
									false
								);
							}}
							className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
								managementFilter ===
									"none" &&
								filter ===
									item
									? "bg-gray-900 text-white"
									: "text-gray-600 hover:bg-gray-100"
							}`}
						>
							{item}
						</button>
					))}

					{/* 관리함 */}
					<div
						ref={
							managementMenuRef
						}
						className="relative shrink-0"
					>
						<button
							type="button"
							onClick={() =>
								setManagementMenuOpen(
									(prev) =>
										!prev
								)
							}
							className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
								managementFilter !==
								"none"
									? "bg-gray-900 text-white"
									: "text-gray-600 hover:bg-gray-100"
							}`}
						>
							관리함{" "}
							<span className="ml-1">
								▾
							</span>
						</button>

						{managementMenuOpen && (
							<div className="absolute right-0 top-10 z-40 w-36 rounded-xl border bg-white p-1 shadow-lg">
								<button
									type="button"
									onClick={() => {
										setManagementFilter(
											"reread"
										);
										setFilter(
											"전체"
										);
										setManagementMenuOpen(
											false
										);
									}}
									className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium transition sm:text-sm ${
										managementFilter ===
										"reread"
											? "bg-gray-100 text-gray-900"
											: "text-gray-700 hover:bg-gray-100"
									}`}
								>
									다시 볼 작품
								</button>

								<button
									type="button"
									onClick={() => {
										setManagementFilter(
											"excluded"
										);
										setFilter(
											"전체"
										);
										setManagementMenuOpen(
											false
										);
									}}
									className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium transition sm:text-sm ${
										managementFilter ===
										"excluded"
											? "bg-gray-100 text-gray-900"
											: "text-gray-700 hover:bg-gray-100"
									}`}
								>
									제외한 작품
								</button>

								{managementFilter !==
									"none" && (
									<>
										<div className="my-1 border-t" />

										<button
											type="button"
											onClick={() => {
												setManagementFilter(
													"none"
												);
												setFilter(
													"전체"
												);
												setManagementMenuOpen(
													false
												);
											}}
											className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-500 transition hover:bg-gray-100 sm:text-sm"
										>
											일반 목록
										</button>
									</>
								)}
							</div>
						)}
					</div>
				</div>

				{/* 최근 읽은 소설 - 가로 스크롤 캐러셀 */}
				{filter === "전체" &&
					managementFilter ===
						"none" && (
						<section className="mt-8 sm:mt-10">
							<div className="flex items-center justify-between">
								<h3 className="text-base font-semibold sm:text-lg">
									최근 읽은 소설
								</h3>

								{recentBooks.length >
									0 && (
									<span className="flex items-center gap-0.5 text-xs text-gray-400">
										옆으로 스크롤
										<ChevronRight className="h-3.5 w-3.5" />
									</span>
								)}
							</div>

							{loading ? (
								<div className="mt-3 rounded-2xl border bg-white px-5 py-10 text-center text-sm text-gray-400 sm:mt-4 sm:px-6 sm:py-12">
									서재를 불러오는 중...
								</div>
							) : recentBooks.length ===
							  0 ? (
								<div className="mt-3 rounded-2xl border bg-white px-5 py-10 text-center text-sm text-gray-400 sm:mt-4 sm:px-6 sm:py-12">
									최근 읽은 소설이 없습니다.
								</div>
							) : (
								<div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:mt-4">
									{recentBooks.map(
										(
											book
										) => (
											<div
												key={
													book.id
												}
												className="relative w-64 shrink-0 snap-start rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-72"
											>
												{renderBookMenu(
													book
												)}

												<div className="flex items-start justify-between gap-3 pr-6">
													<div className="flex items-start gap-3">
														<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
															<BookOpen
																className="h-4.5 w-4.5 text-gray-400"
																strokeWidth={
																	1.75
																}
															/>
														</div>

														<div className="min-w-0">
															<h4 className="line-clamp-2 text-sm font-semibold leading-5">
																{
																	book.title
																}
															</h4>

															<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
																<span
																	className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[getDisplayStatus(book)]}`}
																>
																	{getDisplayStatus(
																		book
																	)}
																</span>

																<span
																	className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
																		book.series_status ===
																		"completed"
																			? "bg-purple-50 text-purple-700"
																			: "bg-orange-50 text-orange-700"
																	}`}
																>
																	{book.series_status ===
																	"completed"
																		? "완결"
																		: "연재중"}
																</span>
															</div>
														</div>
													</div>

													<div className="relative flex shrink-0 items-center justify-center">
														<ProgressRing
															percent={getProgress(
																book
															)}
															status={getDisplayStatus(
																book
															)}
															size={
																38
															}
														/>
													</div>
												</div>

												<div className="mt-3 flex items-center justify-between text-xs text-gray-500">
													<span>
														{getRound(
															book
														)}
														회독 ·{" "}
														{getEpisode(
															book
														)}
														화 /{" "}
														{getEffectiveTotalEpisodes(
															book
														)}
														화
													</span>

													<span className="font-semibold text-gray-700">
														{getProgress(
															book
														)}
														%
													</span>
												</div>

												<div className="mt-3 flex items-center justify-between border-t pt-3">
													<span className="text-[11px] text-gray-400">
														{new Date(
															book.updated_at
														).toLocaleDateString(
															"ko-KR"
														)}{" "}
														수정
													</span>

													{renderAction(
														book
													)}
												</div>
											</div>
										)
									)}
								</div>
							)}
						</section>
					)}

				{/* 전체 소설 / 관리함 */}
				<section
					ref={
						allBooksSectionRef
					}
					className="mt-10 sm:mt-12"
				>
					<div className="flex items-center justify-between">
						<h3 className="text-base font-semibold sm:text-lg">
							{getSectionTitle()}

							<span className="ml-1.5 text-sm font-normal text-gray-400">
								{
									sortedBooks.length
								}
							</span>
						</h3>

						<button
							type="button"
							disabled={syncing}
							onClick={async () => {
								setSyncing(
									true
								);
								setError(
									""
								);

								try {
									const response =
										await fetch(
											"/api/books/sync"
										);

									const data =
										await response.json();

									if (
										!response.ok
									) {
										throw new Error(
											typeof data?.error ===
												"string"
												? data.error
												: "동기화에 실패했습니다."
										);
									}

									await loadBooks();
								} catch (error) {
									setError(
										error instanceof
											Error
											? error.message
											: "동기화 중 오류가 발생했습니다."
									);
								} finally {
									setSyncing(
										false
									);
								}
							}}
							className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 sm:px-3 sm:py-2 sm:text-sm"
						>
							<RotateCcw
								className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
									syncing
										? "animate-spin"
										: ""
								}`}
								strokeWidth={
									1.75
								}
							/>

							{syncing
								? "동기화 중..."
								: "새로고침"}
						</button>
					</div>

					{/* 검색 */}
					<div className="relative mt-4 sm:mt-5">
						<Search
							className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
							strokeWidth={
								1.75
							}
						/>

						<input
							type="text"
							value={
								search
							}
							onChange={(
								event
							) =>
								setSearch(
									event
										.target
										.value
								)
							}
							placeholder="소설 제목 검색"
							className="h-10 w-full rounded-xl border bg-white pl-9 pr-9 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 sm:h-11"
						/>

						{search && (
							<button
								type="button"
								onClick={() =>
									setSearch(
										""
									)
								}
								aria-label="검색어 지우기"
								className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							>
								<X
									className="h-3.5 w-3.5"
									strokeWidth={
										2
									}
								/>
							</button>
						)}
					</div>

					{/* 정렬 + 태그 필터 열기 */}
					<div className="mt-3 flex items-center gap-1.5 sm:mt-4 sm:gap-2">
						{(
							[
								{
									key: "default",
									label: "기본순",
								},
								{
									key: "episodes",
									label: "화수 많은순",
								},
								{
									key: "title",
									label: "가나다순",
								},
							] as const
						).map(
							(opt) => (
								<button
									key={
										opt.key
									}
									type="button"
									onClick={() =>
										changeSortOption(
											opt.key
										)
									}
									className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition sm:px-3 sm:text-sm ${
										sortOption ===
										opt.key
											? "border-gray-900 bg-gray-900 text-white"
											: "border-gray-200 text-gray-500 hover:bg-gray-50"
									}`}
								>
									{
										opt.label
									}
								</button>
							)
						)}

						{managementFilter ===
							"none" && (
							<button
								type="button"
								onClick={() =>
									setTagFilterOpen(
										(
											prev
										) =>
											!prev
									)
								}
								className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition sm:px-3.5 sm:py-1.5 sm:text-sm ${
									activeTags.size >
									0
										? "border-blue-600 bg-blue-50 text-blue-700"
										: tagFilterOpen
											? "border-gray-900 bg-gray-900 text-white"
											: "border-gray-200 text-gray-500 hover:bg-gray-50"
								}`}
							>
								<Filter
									className="h-3.5 w-3.5"
									strokeWidth={
										1.75
									}
								/>

								필터

								{activeTags.size >
									0 && (
									<span className="ml-0.5">
										{
											activeTags.size
										}
									</span>
								)}

								<ChevronDown
									className={`h-3.5 w-3.5 transition-transform ${
										tagFilterOpen
											? "rotate-180"
											: ""
									}`}
									strokeWidth={
										1.75
									}
								/>
							</button>
						)}
					</div>

					{/* 완결 / 미완 / 단편 / 중편 / 장편 / 초기화 - 필터 버튼을 눌러야 열림 */}
					{managementFilter ===
						"none" &&
						tagFilterOpen && (
							<div className="mt-3 flex items-center gap-1 overflow-x-auto sm:mt-4 sm:gap-2">
								{TOGGLE_TAGS.map(
									(tag) => {
										const isActive =
											activeTags.has(
												tag
											);

										const isCompletionTag =
											COMPLETION_TAGS.includes(
												tag
											);

										return (
											<button
												key={
													tag
												}
												type="button"
												onClick={() =>
													toggleTag(
														tag
													)
												}
												className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition sm:px-3.5 sm:py-1.5 ${
													isActive
														? isCompletionTag
															? "border-purple-600 bg-purple-50 text-purple-700"
															: "border-blue-600 bg-blue-50 text-blue-700"
														: "border-gray-200 text-gray-500 hover:bg-gray-50"
												}`}
											>
												{
													tag
												}
											</button>
										);
									}
								)}

								<button
									type="button"
									onClick={
										resetTags
									}
									disabled={
										activeTags.size ===
										0
									}
									className="ml-1 shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 disabled:cursor-default disabled:opacity-40 sm:px-3.5 sm:py-1.5"
								>
									초기화
								</button>
							</div>
						)}

					{/* 소설 목록 - 가로형 카드 리스트 */}
					{loading ? (
						<div className="mt-3 rounded-2xl border bg-white px-5 py-10 text-center text-sm text-gray-400 sm:mt-4 sm:px-6 sm:py-12">
							불러오는 중...
						</div>
					) : filteredBooks.length ===
					  0 ? (
						<div className="mt-3 rounded-2xl border bg-white px-5 py-10 text-center text-sm text-gray-400 sm:mt-4 sm:px-6 sm:py-12">
							{getEmptyMessage()}
						</div>
					) : (
						<>
							<div className="mt-3 flex flex-col gap-2 sm:mt-4">
								{paginatedBooks.map(
									(
										book
									) => (
										<div
											key={
												book.id
											}
											className="relative flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:px-5 sm:py-4"
										>
											{renderBookMenu(
												book
											)}

											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 sm:h-11 sm:w-11">
												<BookOpen
													className="h-4 w-4 text-gray-400 sm:h-4.5 sm:w-4.5"
													strokeWidth={
														1.75
													}
												/>
											</div>

											<div className="min-w-0 flex-1 pr-7">
												<h4 className="line-clamp-2 text-sm font-medium leading-5 sm:text-[15px]">
													{
														book.title
													}
												</h4>

												<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
													<span
														className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[getDisplayStatus(book)]}`}
													>
														{getDisplayStatus(
															book
														)}
													</span>

													<span
														className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
															book.series_status ===
															"completed"
																? "bg-purple-50 text-purple-700"
																: "bg-orange-50 text-orange-700"
														}`}
													>
														{book.series_status ===
														"completed"
															? "완결"
															: "연재중"}
													</span>

													<span className="text-xs text-gray-400">
														{getRound(
															book
														)}
														회독 ·{" "}
														{getEpisode(
															book
														)}
														화
													</span>
												</div>
											</div>

											<div className="flex shrink-0 items-center gap-2.5">
												<div className="relative flex items-center justify-center">
													<ProgressRing
														percent={getProgress(
															book
														)}
														status={getDisplayStatus(
															book
														)}
														size={
															32
														}
													/>
												</div>

												<div className="hidden sm:block">
													{renderAction(
														book,
														true
													)}
												</div>
											</div>

											<div className="absolute bottom-3 right-4 sm:hidden">
												{renderAction(
													book,
													true
												)}
											</div>
										</div>
									)
								)}
							</div>

							{/* 페이지네이션 */}
							{totalPages >
								1 && (
								<div className="mt-5 flex items-center justify-center gap-1 sm:gap-1.5">
									<button
										type="button"
										onClick={() =>
											changePage(
												currentPage -
													1
											)
										}
										disabled={
											currentPage ===
											1
										}
										className="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-default disabled:opacity-30 sm:px-3 sm:text-sm"
									>
										이전
									</button>

									{pageNumbers.map(
										(
											page
										) => (
											<button
												key={
													page
												}
												type="button"
												onClick={() =>
													changePage(
														page
													)
												}
												className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition sm:h-9 sm:min-w-9 sm:text-sm ${
													currentPage ===
													page
														? "bg-gray-900 text-white"
														: "bg-white text-gray-500 hover:bg-gray-100"
												}`}
											>
												{
													page
												}
											</button>
										)
									)}

									<button
										type="button"
										onClick={() =>
											changePage(
												currentPage +
													1
											)
										}
										disabled={
											currentPage ===
											totalPages
										}
										className="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-default disabled:opacity-30 sm:px-3 sm:text-sm"
									>
										다음
									</button>
								</div>
							)}
						</>
					)}
				</section>
			</section>

			{/* 맨 위로 */}
			{showScrollTop && (
				<button
					type="button"
					onClick={
						scrollToTop
					}
					aria-label="맨 위로"
					className="fixed bottom-20 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border bg-white text-gray-600 shadow-md transition hover:bg-gray-50 hover:text-gray-900 sm:bottom-24 sm:right-8 sm:h-11 sm:w-11"
				>
					<ArrowUp
						className="h-4 w-4 sm:h-5 sm:w-5"
						strokeWidth={
							1.75
						}
					/>
				</button>
			)}
		</main>
	);
}
