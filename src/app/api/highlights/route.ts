import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const driveFileId =
      searchParams.get("driveFileId");

    const episode =
      searchParams.get("episode");

    // 특정 회차의 하이라이트 조회
    if (driveFileId && episode) {
      const episodeNumber = Number(episode);

      if (!Number.isFinite(episodeNumber)) {
        return Response.json(
          { error: "episode 값이 올바르지 않습니다." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("highlights")
        .select(
          "id, book_id, drive_file_id, episode, text, start_offset, end_offset, created_at"
        )
        .eq("user_id", session.user.email)
        .eq("drive_file_id", driveFileId)
        .eq("episode", episodeNumber)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "HIGHLIGHT EPISODE GET ERROR:",
          error
        );

        return Response.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return Response.json({
        data: data || [],
      });
    }

    // 전체 하이라이트 조회
    const { data, error } = await supabase
      .from("highlights")
      .select(
        "id, book_id, drive_file_id, episode, text, start_offset, end_offset, created_at"
      )
      .eq("user_id", session.user.email)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "HIGHLIGHT LIST GET ERROR:",
        error
      );

      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      data: data || [],
    });
  } catch (error) {
    console.error(
      "HIGHLIGHT GET ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "하이라이트를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
      book_id,
      drive_file_id,
      episode,
      text,
      start_offset,
      end_offset,
    } = body;

    if (
      !book_id ||
      !drive_file_id ||
      typeof episode !== "number" ||
      !text
    ) {
      return Response.json(
        {
          error:
            "book_id, drive_file_id, episode, text가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: session.user.email,
        book_id,
        drive_file_id,
        episode,
        text,
        start_offset:
          typeof start_offset === "number"
            ? start_offset
            : null,
        end_offset:
          typeof end_offset === "number"
            ? end_offset
            : null,
      })
      .select()
      .maybeSingle();

    if (error) {
      // 이미 동일한 하이라이트가 있는 경우
      if (error.code === "23505") {
        return Response.json({
          success: true,
          alreadyHighlighted: true,
        });
      }

      console.error(
        "HIGHLIGHT INSERT ERROR:",
        error
      );

      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "HIGHLIGHT POST ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "하이라이트 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "id가 필요합니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.email);

    if (error) {
      console.error(
        "HIGHLIGHT DELETE ERROR:",
        error
      );

      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "HIGHLIGHT DELETE ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "하이라이트 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}