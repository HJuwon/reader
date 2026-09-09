"use client";

import {
	useEffect,
	useState,
} from "react";

export type ThemeKey =
	| "ivory"
	| "white"
	| "sage"
	| "gray"
	| "dark";

export type ThemeConfig = {
	label: string;
	bg: string;
	accent: string;
	text: string;
	title: string;
	muted: string;
	divider: string;
	swatch: string;
};

export const THEMES: Record<
	ThemeKey,
	ThemeConfig
> = {
	ivory: {
		label: "아이보리",
		bg: "#fafaf8",
		accent: "#b08d5f",
		text: "#45453f",
		title: "#1e1e1c",
		muted: "#b0b0a4",
		divider: "#eeeee7",
		swatch: "#faf6ee",
	},

	white: {
		label: "흰색",
		bg: "#ffffff",
		accent: "#8a8a7e",
		text: "#3a3a3a",
		title: "#1a1a1a",
		muted: "#9a9a9a",
		divider: "#ececec",
		swatch: "#ffffff",
	},

	sage: {
		label: "세이지",
		bg: "#f4f6f0",
		accent: "#7a8f5f",
		text: "#465239",
		title: "#2e3a24",
		muted: "#93a183",
		divider: "#e2e6da",
		swatch: "#eef2e6",
	},

	gray: {
		label: "그레이",
		bg: "#f5f5f3",
		accent: "#8a8a80",
		text: "#4a4a44",
		title: "#2a2a26",
		muted: "#a3a39a",
		divider: "#e6e6e2",
		swatch: "#ebebe7",
	},

	dark: {
		label: "다크",
		bg: "#1c1c1b",
		accent: "#c7a97a",
		text: "#d8d8d2",
		title: "#f1f1ec",
		muted: "#8f8f88",
		divider: "#333330",
		swatch: "#1c1c1b",
	},
};

export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 22;
export const DEFAULT_FONT_SIZE = 16;
export const SETTINGS_KEY =
	"novel-reader-settings";

export function useReaderSettings() {
	const [themeKey, setThemeKey] =
		useState<ThemeKey>("ivory");

	const [fontSize, setFontSize] =
		useState(DEFAULT_FONT_SIZE);

	const [settingsOpen, setSettingsOpen] =
		useState(false);

	const theme =
		THEMES[themeKey];

	/*
	 * 읽기 설정 불러오기
	 */
	useEffect(() => {
		try {
			const saved =
				localStorage.getItem(
					SETTINGS_KEY
				);

			if (!saved) {
				return;
			}

			const parsed =
				JSON.parse(saved);

			if (
				parsed.themeKey &&
				THEMES[
					parsed.themeKey as ThemeKey
				]
			) {
				setThemeKey(
					parsed.themeKey
				);
			}

			if (
				typeof parsed.fontSize ===
				"number"
			) {
				setFontSize(
					Math.min(
						MAX_FONT_SIZE,
						Math.max(
							MIN_FONT_SIZE,
							parsed.fontSize
						)
					)
				);
			}
		} catch {
			// 기본값 사용
		}
	}, []);

	/*
	 * 읽기 설정 저장
	 */
	useEffect(() => {
		try {
			localStorage.setItem(
				SETTINGS_KEY,
				JSON.stringify({
					themeKey,
					fontSize,
				})
			);
		} catch {
			// 무시
		}
	}, [
		themeKey,
		fontSize,
	]);

	return {
		themeKey,
		setThemeKey,

		fontSize,
		setFontSize,

		settingsOpen,
		setSettingsOpen,

		theme,
	};
}

