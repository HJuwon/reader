"use client";

import { useEffect, useRef, useState } from "react";

type Params = {
	/** 정주행 켜짐 여부 */
	enabled: boolean;
	/** 본문이 열려 있고 다음 화가 있는지 */
	hasNext: boolean;
	/** 편집 중 등 막아야 할 때 */
	disabled?: boolean;
	/** 다음 화로 이동 */
	onNext: () => void | Promise<void>;
	/** 회차가 바뀌면 값이 바뀐다 (진행률 초기화용) */
	resetKey: unknown;
};

/** 손가락을 얼마나 더 밀어야 넘어가는지(px) / 휠 누적량 */
const PULL_THRESHOLD = 90;
const BOTTOM_TOLERANCE = 6;

function isAtBottom() {
	const doc = document.documentElement;

	return (
		window.scrollY + window.innerHeight >=
		doc.scrollHeight - BOTTOM_TOLERANCE
	);
}

/**
 * 정주행: 본문 맨 아래까지 내린 뒤 한 번 더 아래로 밀면 다음 화로 넘어간다.
 * 반환값 progress(0~1)는 "더 밀면 넘어가요" 안내 표시에 쓴다.
 */
export function useMarathonScroll({
	enabled,
	hasNext,
	disabled = false,
	onNext,
	resetKey,
}: Params) {
	// 어느 회차에서 얼마나 당겼는지 함께 저장해서, 회차가 바뀌면 자동으로 0이 된다.
	const [pull, setPull] = useState({
		key: resetKey,
		value: 0,
	});

	const pullRef = useRef(0);
	const touchYRef = useRef<number | null>(null);
	const firedRef = useRef(false);
	const onNextRef = useRef(onNext);

	useEffect(() => {
		onNextRef.current = onNext;
	}, [onNext]);

	// 회차가 바뀌면 내부 상태 초기화
	useEffect(() => {
		pullRef.current = 0;
		firedRef.current = false;
		touchYRef.current = null;
	}, [resetKey]);

	const active = enabled && hasNext && !disabled;

	useEffect(() => {
		if (!active) {
			pullRef.current = 0;
			return;
		}

		const update = (value: number) => {
			pullRef.current = Math.max(0, value);
			setPull({
				key: resetKey,
				value: Math.min(
					1,
					pullRef.current / PULL_THRESHOLD
				),
			});

			if (
				pullRef.current >= PULL_THRESHOLD &&
				!firedRef.current
			) {
				firedRef.current = true;
				pullRef.current = 0;
				setPull({ key: resetKey, value: 0 });
				void onNextRef.current();
			}
		};

		/* 내리던 관성으로 바닥에 닿자마자 넘어가지 않도록,
		 * 바닥에 닿은 뒤 잠깐(400ms)은 밀기를 세지 않는다. */
		let lastNotBottomAt = performance.now();

		const canPull = () => {
			if (!isAtBottom()) {
				lastNotBottomAt = performance.now();
				return false;
			}

			return performance.now() - lastNotBottomAt > 400;
		};

		const handleWheel = (event: WheelEvent) => {
			if (event.deltaY > 0 && canPull()) {
				update(pullRef.current + event.deltaY);
			} else {
				update(0);
			}
		};

		const handleTouchStart = () => {
			touchYRef.current = null;
		};

		const handleTouchMove = (event: TouchEvent) => {
			const y = event.touches[0]?.clientY;

			if (y === undefined) {
				return;
			}

			if (!canPull()) {
				touchYRef.current = null;
				update(0);
				return;
			}

			// 바닥에서 밀기 시작한 지점을 기준으로 잰다
			if (touchYRef.current === null) {
				touchYRef.current = y;
			}

			const delta = touchYRef.current - y;

			update(delta > 0 ? delta : 0);
		};

		const handleTouchEnd = () => {
			touchYRef.current = null;
			update(0);
		};

		window.addEventListener("wheel", handleWheel, {
			passive: true,
		});
		window.addEventListener(
			"touchstart",
			handleTouchStart,
			{ passive: true }
		);
		window.addEventListener(
			"touchmove",
			handleTouchMove,
			{ passive: true }
		);
		window.addEventListener("touchend", handleTouchEnd);

		return () => {
			window.removeEventListener("wheel", handleWheel);
			window.removeEventListener(
				"touchstart",
				handleTouchStart
			);
			window.removeEventListener(
				"touchmove",
				handleTouchMove
			);
			window.removeEventListener(
				"touchend",
				handleTouchEnd
			);
		};
	}, [active, resetKey]);

	return {
		progress:
			active && pull.key === resetKey ? pull.value : 0,
	};
}
