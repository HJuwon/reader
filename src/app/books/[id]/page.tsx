"use client";

import Link from "next/link";
import { useState } from "react";
import { FixedSizeList } from "react-window";
import {
  ArrowLeft,
  Bookmark,
  Highlighter,
  History,
  List,
  Search,
  ChevronDown,
  Play,
  Check,
} from "lucide-react";

// 화 목록 항목 하나의 고정 높이(px). 실측 기준값 — 바꾸면 itemSize도 같이 맞출 것.
const CHAPTER_ROW_HEIGHT = 52;

const chapters = Array.from({ length: 210 }, (_, index) => index + 1);

export default function BookDetailPage() {
  const [activeTab, setActiveTab] = useState("목차");
  const [sortNewest, setSortNewest] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chapterInput, setChapterInput] = useState("");
  const currentChapter = 152;

  const displayedChapters = sortNewest
    ? [...chapters].reverse()
    : chapters;

  const filteredChapters = chapterInput
    ? displayedChapters.filter((chapter) =>
        String(chapter).includes(chapterInput)
      )
    : displayedChapters;

  const handleChapterMove = () => {
    const chapter = Number(chapterInput);

    if (chapter >= 1 && chapter <= 210) {
      alert(`${chapter}화로 이동합니다.`);
    } else {
      alert("1화부터 210화 사이의 화수를 입력해주세요.");
    }
  };

  const tabs = [
    { name: "목차", icon: List },
    { name: "북마크", icon: Bookmark },
    { name: "하이라이트", icon: Highlighter },
    { name: "읽기 이력", icon: History },
  ];

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 pb-24">
      {/* 상단 — 얇은 헤더, 배경과 거의 구분 안 되게 */}
      <header className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <button
            onClick={() => window.history.back()}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>

          <span className="ml-2 truncate text-sm text-gray-400">
            검술명가 막내아들
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {/* 소설 정보 — 카드 없이 페이지 배경 위에 바로 얹어서 여백으로 숨쉬게 함 */}
        <section className="pt-2 pb-6">
          <h2 className="font-serif text-2xl leading-snug tracking-tight">
            검술명가 막내아들
          </h2>

          <p className="mt-1.5 text-sm text-gray-400">가상의 작가</p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {currentChapter}화 읽는 중
              </span>
              <span className="font-medium text-gray-700">73%</span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200/70">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: "73%" }}
              />
            </div>
          </div>

            <Link
            href="/reader/1?chapter=152"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
            >
            <Play className="h-4 w-4 fill-current" />
            이어서 읽기 · {currentChapter}화
            </Link>
        </section>

        {/* 탭 — 밑줄 대신 세그먼트 컨트롤 형태로, 회색 트랙 안에서 흰 배경이 이동 */}
        <div className="sticky top-14 z-10 -mx-4 bg-gray-50/90 px-4 pb-3 pt-1 backdrop-blur">
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-gray-200/60 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.name;

              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-xs transition ${
                    isActive
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 목차 */}
        {activeTab === "목차" && (
          <section className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">목차</h3>
                  <p className="mt-0.5 text-xs text-gray-400">총 210화</p>
                </div>

                <button
                  onClick={() => setSortNewest(!sortNewest)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                >
                  {sortNewest ? "최신순" : "오래된순"}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* 화수 검색 */}
              <div className="mt-4">
                {!searchOpen ? (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="flex w-full items-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-400"
                  >
                    <Search className="h-4 w-4" />
                    화수로 이동
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                      <input
                        type="number"
                        min="1"
                        max="210"
                        value={chapterInput}
                        onChange={(e) => setChapterInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleChapterMove();
                          }
                        }}
                        placeholder="화수 입력"
                        autoFocus
                        className="w-full rounded-xl bg-gray-100 py-3 pl-10 pr-3 text-sm outline-none focus:bg-gray-50 focus:ring-1 focus:ring-gray-300"
                      />
                    </div>

                    <button
                      onClick={handleChapterMove}
                      className="rounded-xl bg-gray-900 px-4 text-sm font-medium text-white"
                    >
                      이동
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 화 목록 — react-window 가상 스크롤.
                줄 사이 경계선 대신 행 자체에 살짝 둥근 모서리를 줘서 표처럼 보이지 않게 함 */}
            <FixedSizeList
              height={560}
              itemCount={filteredChapters.length}
              itemSize={CHAPTER_ROW_HEIGHT}
              width="100%"
            >
              {({ index, style }) => {
                const chapter = filteredChapters[index];
                const isCurrent = chapter === currentChapter;
                const isRead = chapter <= currentChapter && !isCurrent;

                return (
                  <div style={style} className="px-2">
                    <button
                      onClick={() => alert(`${chapter}화를 읽습니다.`)}
                      className={`flex h-full w-full items-center justify-between rounded-xl px-3 text-left transition ${
                        isCurrent ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isCurrent ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        ) : (
                          <div
                            className={`w-6 text-center text-xs ${
                              isRead ? "text-gray-300" : "text-gray-400"
                            }`}
                          >
                            {chapter}
                          </div>
                        )}

                        <span
                          className={`text-sm ${
                            isCurrent
                              ? "font-semibold text-blue-700"
                              : isRead
                              ? "text-gray-400"
                              : "font-medium text-gray-700"
                          }`}
                        >
                          제{chapter}화
                        </span>
                      </div>

                      {isCurrent && (
                        <span className="text-xs font-medium text-blue-600">
                          읽는 중
                        </span>
                      )}
                    </button>
                  </div>
                );
              }}
            </FixedSizeList>
          </section>
        )}

        {/* 북마크 */}
        {activeTab === "북마크" && (
          <section className="mt-3 rounded-2xl bg-white px-5 py-12 text-center shadow-sm">
            <Bookmark className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.5} />
            <h3 className="mt-4 font-medium">북마크가 없습니다</h3>
            <p className="mt-2 text-sm text-gray-400">
              읽다가 기억하고 싶은 부분을 북마크할 수 있습니다.
            </p>
          </section>
        )}

        {/* 하이라이트 */}
        {activeTab === "하이라이트" && (
          <section className="mt-3 rounded-2xl bg-white px-5 py-12 text-center shadow-sm">
            <Highlighter className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.5} />
            <h3 className="mt-4 font-medium">하이라이트가 없습니다</h3>
            <p className="mt-2 text-sm text-gray-400">
              소설의 문장을 선택해서 하이라이트할 수 있습니다.
            </p>
          </section>
        )}

        {/* 읽기 이력 */}
        {activeTab === "읽기 이력" && (
          <section className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="px-5 pt-5 pb-3">
              <h3 className="font-medium">읽기 이력</h3>
            </div>

            <div className="px-2 pb-2">
              <div className="rounded-xl px-3 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">1회차</span>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    완독
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  2026년 8월 20일 ~ 2026년 8월 27일
                </p>
              </div>

              <div className="rounded-xl px-3 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">2회차</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    읽는 중
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  2026년 9월 1일 ~ 현재
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}