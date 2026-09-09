"use client";

import { useCallback, useState } from "react";

export function useReaderChrome() {
	const [chromeVisible, setChromeVisible] =
		useState(true);

	const handleContentTap = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const target =
				event.target as HTMLElement;

			if (
				target.closest(
					"button, a, input, textarea"
				)
			) {
				return;
			}

			const selection =
				window.getSelection?.();

			if (
				selection &&
				selection.toString().length > 0
			) {
				return;
			}

			setChromeVisible(
				(visible) => !visible
			);
		},
		[]
	);

	return {
		chromeVisible,
		setChromeVisible,
		handleContentTap,
	};
}