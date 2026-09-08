
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const userId = session.user.email;

  try {
    const { data, error } = await supabase
      .from("episode_rules")
      .select("id,rule,created_at")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "회차 규칙 조회 실패:",
        error
      );

      return NextResponse.json(
        {
          error:
            "회차 규칙을 불러오지 못했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data ?? [],
    });
  } catch (error) {
    console.error(
      "회차 규칙 조회 중 오류:",
      error
    );

    return NextResponse.json(
      {
        error:
          "회차 규칙을 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const userId = session.user.email;

  try {
    const body = await request.json();

    const rule =
      typeof body.rule === "string"
        ? body.rule.trim()
        : "";

    if (!rule) {
      return NextResponse.json(
        {
          error:
            "회차 규칙을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    if (!rule.includes("xxx")) {
      return NextResponse.json(
        {
          error:
            "회차 규칙에는 xxx가 포함되어야 합니다.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("episode_rules")
      .upsert(
        {
          user_id: userId,
          rule,
        },
        {
          onConflict: "user_id,rule",
        }
      )
      .select("id,rule,created_at")
      .single();

    if (error) {
      console.error(
        "회차 규칙 추가 실패:",
        error
      );

      return NextResponse.json(
        {
          error:
            "회차 규칙을 추가하지 못했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
    });
  } catch (error) {
    console.error(
      "회차 규칙 추가 중 오류:",
      error
    );

    return NextResponse.json(
      {
        error:
          "회차 규칙을 추가하지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request
) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const userId = session.user.email;

  try {
    const body = await request.json();

    const id = body.id;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "삭제할 회차 규칙을 찾을 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("episode_rules")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error(
        "회차 규칙 삭제 실패:",
        error
      );

      return NextResponse.json(
        {
          error:
            "회차 규칙을 삭제하지 못했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "회차 규칙 삭제 중 오류:",
      error
    );

    return NextResponse.json(
      {
        error:
          "회차 규칙을 삭제하지 못했습니다.",
      },
      { status: 500 }
    );
  }
}
