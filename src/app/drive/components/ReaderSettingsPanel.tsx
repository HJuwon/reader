"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ChevronDown,
  ListOrdered,
  Minus,
  Pencil,
  Plus,
  X,
} from "lucide-react";

import {
  DEFAULT_LETTER_SPACING,
  DEFAULT_LINE_HEIGHT,
  FONT_OPTIONS,
  MAX_FONT_SIZE,
  MAX_LETTER_SPACING,
  MAX_LINE_HEIGHT,
  MIN_FONT_SIZE,
  MIN_LETTER_SPACING,
  MIN_LINE_HEIGHT,
  THEMES,
  type FontKey,
  type ThemeConfig,
  type ThemeKey,
} from "../hooks/useReaderSettings";

type Props = {
  theme: ThemeConfig;
  themeKey: ThemeKey;
  setThemeKey: (key: ThemeKey) => void;

  fontSize: number;
  setFontSize: Dispatch<SetStateAction<number>>;
  fontKey: FontKey;
  setFontKey: (key: FontKey) => void;
  lineHeight: number;
  setLineHeight: (value: number) => void;
  letterSpacing: number;
  setLetterSpacing: (value: number) => void;

  marathon: boolean;
  setMarathon: Dispatch<SetStateAction<boolean>>;

  /** 본문 수정 중에는 위쪽 수정 버튼을 숨긴다 */
  editingContent: boolean;
  onOpenEpisodeEdit: () => void;
  onEditContent: () => void;
  onClose: () => void;
};

const round = (value: number, digits: number) =>
  Number(value.toFixed(digits));

/** 이름 + [-] 값 [+] 한 줄 */
function Stepper({
  theme,
  label,
  valueText,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  theme: ThemeConfig;
  label: string;
  valueText: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled: boolean;
  plusDisabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm" style={{ color: theme.title }}>
        {label}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMinus}
          disabled={minusDisabled}
          aria-label={`${label} 줄이기`}
          className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30"
          style={{ border: `1px solid ${theme.divider}`, color: theme.text }}
        >
          <Minus className="h-4 w-4" />
        </button>

        <span
          className="w-12 text-center text-sm tabular-nums"
          style={{ color: theme.title }}
        >
          {valueText}
        </span>

        <button
          type="button"
          onClick={onPlus}
          disabled={plusDisabled}
          aria-label={`${label} 늘리기`}
          className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30"
          style={{ border: `1px solid ${theme.divider}`, color: theme.text }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * 읽기 설정 패널 (B안).
 * 자주 쓰는 것(글자 크기·배경·정주행)만 위에 두고,
 * 글꼴·줄 간격·글자 간격은 "글자 모양" 아래로 접어 둔다.
 * 기능은 그대로: 글자 크기·글꼴·줄 간격·글자 간격·배경색·정주행·회차/본문 수정
 */
export default function ReaderSettingsPanel({
  theme,
  themeKey,
  setThemeKey,
  fontSize,
  setFontSize,
  fontKey,
  setFontKey,
  lineHeight,
  setLineHeight,
  letterSpacing,
  setLetterSpacing,
  marathon,
  setMarathon,
  editingContent,
  onOpenEpisodeEdit,
  onEditContent,
  onClose,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const isDefault =
    lineHeight === DEFAULT_LINE_HEIGHT &&
    letterSpacing === DEFAULT_LETTER_SPACING &&
    fontKey === "myeongjo";

  const resetDetail = () => {
    setLineHeight(DEFAULT_LINE_HEIGHT);
    setLetterSpacing(DEFAULT_LETTER_SPACING);
    setFontKey("myeongjo");
  };

  const rowStyle = {
    borderTop: `0.5px solid ${theme.divider}`,
  } as const;

  return (
    <div
      className="w-72 max-w-full rounded-2xl px-4 pb-4 pt-2"
      style={{
        backgroundColor: theme.bg,
        color: theme.title,
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        border: `0.5px solid ${theme.divider}`,
      }}
    >
      {/* 제목줄 */}
      <div className="flex items-center justify-between py-2.5">
        <p className="text-sm font-semibold" style={{ color: theme.title }}>
          읽기 설정
        </p>

        <button
          onClick={onClose}
          aria-label="설정 닫기"
          className="hover:opacity-70"
          style={{ color: theme.muted }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 글자 크기 */}
      <div style={rowStyle}>
        <Stepper
          theme={theme}
          label="글자 크기"
          valueText={String(fontSize)}
          onMinus={() => setFontSize((v) => Math.max(MIN_FONT_SIZE, v - 1))}
          onPlus={() => setFontSize((v) => Math.min(MAX_FONT_SIZE, v + 1))}
          minusDisabled={fontSize <= MIN_FONT_SIZE}
          plusDisabled={fontSize >= MAX_FONT_SIZE}
        />
      </div>

      {/* 배경 */}
      <div
        className="flex items-center justify-between py-3"
        style={rowStyle}
      >
        <span className="text-sm" style={{ color: theme.title }}>
          배경
        </span>

        <div className="flex items-center gap-2">
          {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
            const t = THEMES[key];
            const selected = key === themeKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setThemeKey(key)}
                aria-label={t.label}
                aria-pressed={selected}
                className="block h-7 w-7 rounded-full"
                style={{
                  backgroundColor: t.swatch,
                  boxShadow: selected
                    ? `0 0 0 2px ${theme.bg}, 0 0 0 4px ${t.accent}`
                    : `0 0 0 0.5px ${t.divider}, 0 0 0 1px ${theme.divider}`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 정주행 */}
      <div
        className="flex items-center justify-between py-3"
        style={rowStyle}
      >
        <span className="text-sm" style={{ color: theme.title }}>
          정주행
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={marathon}
          aria-label="정주행 (본문 끝에서 한 번 더 내리면 다음 화)"
          onClick={() => setMarathon((value) => !value)}
          className="relative h-6 w-11 shrink-0 rounded-full transition"
          style={{
            backgroundColor: marathon ? theme.accent : theme.divider,
          }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ left: marathon ? "22px" : "2px" }}
          />
        </button>
      </div>

      {/* 글자 모양 (접기) */}
      <button
        type="button"
        onClick={() => setMoreOpen((open) => !open)}
        aria-expanded={moreOpen}
        className="flex w-full items-center justify-between py-3 text-left"
        style={{ ...rowStyle, color: theme.text }}
      >
        <span className="text-sm">글꼴 · 줄 간격 · 글자 간격</span>

        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ transform: moreOpen ? "rotate(180deg)" : "none" }}
        />
      </button>

      {moreOpen && (
        <div className="pb-1">
          <div className="grid grid-cols-3 gap-2 pb-1 pt-1">
            {(Object.keys(FONT_OPTIONS) as FontKey[]).map((key) => {
              const selected = key === fontKey;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFontKey(key)}
                  aria-pressed={selected}
                  className="rounded-lg px-2 py-2 text-sm transition"
                  style={{
                    fontFamily: FONT_OPTIONS[key].family,
                    color: selected ? theme.bg : theme.text,
                    backgroundColor: selected ? theme.accent : "transparent",
                    border: `1px solid ${
                      selected ? theme.accent : theme.divider
                    }`,
                  }}
                >
                  {FONT_OPTIONS[key].label}
                </button>
              );
            })}
          </div>

          <Stepper
            theme={theme}
            label="줄 간격"
            valueText={lineHeight.toFixed(1)}
            onMinus={() =>
              setLineHeight(
                round(Math.max(MIN_LINE_HEIGHT, lineHeight - 0.1), 1)
              )
            }
            onPlus={() =>
              setLineHeight(
                round(Math.min(MAX_LINE_HEIGHT, lineHeight + 0.1), 1)
              )
            }
            minusDisabled={lineHeight <= MIN_LINE_HEIGHT + 0.001}
            plusDisabled={lineHeight >= MAX_LINE_HEIGHT - 0.001}
          />

          <Stepper
            theme={theme}
            label="글자 간격"
            valueText={String(Math.round(letterSpacing * 100))}
            onMinus={() =>
              setLetterSpacing(
                round(Math.max(MIN_LETTER_SPACING, letterSpacing - 0.01), 2)
              )
            }
            onPlus={() =>
              setLetterSpacing(
                round(Math.min(MAX_LETTER_SPACING, letterSpacing + 0.01), 2)
              )
            }
            minusDisabled={letterSpacing <= MIN_LETTER_SPACING + 0.0001}
            plusDisabled={letterSpacing >= MAX_LETTER_SPACING - 0.0001}
          />

          {!isDefault && (
            <button
              type="button"
              onClick={resetDetail}
              className="w-full py-1.5 text-xs underline"
              style={{ color: theme.muted }}
            >
              기본값으로
            </button>
          )}
        </div>
      )}

      {/* 수정 */}
      {!editingContent && (
        <div
          className="flex items-center gap-5 pt-3 text-[13px]"
          style={rowStyle}
        >
          <button
            type="button"
            onClick={onOpenEpisodeEdit}
            className="flex items-center gap-1.5 hover:opacity-70"
            style={{ color: theme.text }}
          >
            <ListOrdered className="h-4 w-4" />
            회차 수정
          </button>

          <button
            type="button"
            onClick={onEditContent}
            className="flex items-center gap-1.5 hover:opacity-70"
            style={{ color: theme.text }}
          >
            <Pencil className="h-4 w-4" />
            본문 수정
          </button>
        </div>
      )}
    </div>
  );
}
