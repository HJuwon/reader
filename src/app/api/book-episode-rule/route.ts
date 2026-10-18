import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

/**
 * 소설(드라이브 파일)별 회차 규칙 선택 저장.
 *
 * 테이블: book_episode_rules
 *   user_id, drive_file_id (복합 PK), rule_key, source, updated_at
 */

export async function GET(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const fileId = new URL(request.url).searchParams.get(
    "fileId"
  );

  if (!fileId) {
    return NextResponse.json(
      { error: "fileId가 필요합니다." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("book_episode_rules")
    .select("rule_key,source")
    .eq("user_id", session.user.email)
    .eq("drive_file_id", fileId)
    .maybeSingle();

  if (error) {
    console.error("소설별 회차 규칙 조회 실패:", error);

    return NextResponse.json(
      { error: "회차 규칙을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? null });
}

export async function PUT(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const fileId =
      typeof body.fileId === "string" ? body.fileId : "";

    const ruleKey =
      typeof body.ruleKey === "string"
        ? body.ruleKey.trim()
        : "";

    if (!fileId || !ruleKey) {
      return NextResponse.json(
        { error: "fileId와 ruleKey가 필요합니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("book_episode_rules")
      .upsert(
        {
          user_id: session.user.email,
          drive_file_id: fileId,
          rule_key: ruleKey,
          source: "manual",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,drive_file_id" }
      );

    if (error) {
      console.error("소설별 회차 규칙 저장 실패:", error);

      return NextResponse.json(
        { error: "회차 규칙을 저장하지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("소설별 회차 규칙 저장 중 오류:", error);

    return NextResponse.json(
      { error: "회차 규칙을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
