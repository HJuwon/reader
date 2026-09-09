"use client";

import {
	useEffect,
	useState,
} from "react";

export function useEpisodePanel() {
	const [
		episodeRuleManagerOpen,
		setEpisodeRuleManagerOpen,
	] = useState(false);

	const [
		episodeEditPanelOpen,
		setEpisodeEditPanelOpen,
	] = useState(false);

	useEffect(() => {
		if (
			!episodeRuleManagerOpen &&
			!episodeEditPanelOpen
		) {
			return;
		}

		const handleKeyDown = (
			event: KeyboardEvent
		) => {
			if (event.key !== "Escape") {
				return;
			}

			if (episodeEditPanelOpen) {
				setEpisodeEditPanelOpen(false);
				return;
			}

			if (episodeRuleManagerOpen) {
				setEpisodeRuleManagerOpen(false);
			}
		};

		window.addEventListener(
			"keydown",
			handleKeyDown
		);

		return () => {
			window.removeEventListener(
				"keydown",
				handleKeyDown
			);
		};
	}, [
		episodeRuleManagerOpen,
		episodeEditPanelOpen,
	]);

	return {
		episodeRuleManagerOpen,
		setEpisodeRuleManagerOpen,

		episodeEditPanelOpen,
		setEpisodeEditPanelOpen,
	};
}