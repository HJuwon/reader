import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", session.user.email)
    .order("updated_at", { ascending: false });

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return Response.json({
    data,
  });
}

export async function PATCH(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const {
    drive_file_id,
    last_episode,
    progress,
    status,
    scroll_position,
    } = body;

    if (!drive_file_id) {
      return Response.json(
        { error: "drive_file_id가 필요합니다." },
        { status: 400 }
      );
    }

    if (
    typeof last_episode !== "number" ||
    typeof progress !== "number" ||
    !status ||
    typeof scroll_position !== "number"
    ) {
      return Response.json(
        {
          error:
            "last_episode, progress, status가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("books")
      .update({
        last_episode,
        progress,
        status,
        scroll_position,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", session.user.email)
      .eq("drive_file_id", drive_file_id)
      .select();

    if (error) {
      console.error("BOOK PROGRESS UPDATE ERROR:", error);

      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return Response.json(
        {
          error:
            "해당 Drive 파일에 대한 책 정보를 찾지 못했습니다.",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: data[0],
    });
  } catch (error) {
    console.error(
      "BOOK PROGRESS PATCH ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "진행상황 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}