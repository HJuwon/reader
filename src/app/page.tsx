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
