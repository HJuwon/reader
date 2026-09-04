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

    // 특정 회차의 북마크 여부 확인
    if (driveFileId && episode) {
      const episodeNumber = Number(episode);

      if (!Number.isFinite(episodeNumber)) {
        return Response.json(
          { error: "episode 값이 올바르지 않습니다." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", session.user.email)
        .eq("drive_file_id", driveFileId)
        .eq("episode", episodeNumber)
        .maybeSingle();

      if (error) {
        console.error(
          "BOOKMARK STATUS ERROR:",
          error
        );

        return Response.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return Response.json({
        bookmarked: !!data,
        bookmarkId: data?.id || null,
      });
    }

    // 북마크 전체 목록 조회
    const { data, error } = await supabase
      .from("bookmarks")
      .select(
        "id, book_id, drive_file_id, episode, created_at"
      )
      .eq("user_id", session.user.email)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "BOOKMARK LIST ERROR:",
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
      "BOOKMARK GET ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "북마크를 불러오지 못했습니다.",
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
    } = body;

    if (
      !book_id ||
      !drive_file_id ||
      typeof episode !== "number"
    ) {
      return Response.json(
        {
          error:
            "book_id, drive_file_id, episode가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: session.user.email,
        book_id,
        drive_file_id,
        episode,
      })
      .select()
      .maybeSingle();

    if (error) {
      // 이미 존재하는 북마크
      if (error.code === "23505") {
        return Response.json({
          success: true,
          alreadyBookmarked: true,
        });
      }

      console.error(
        "BOOKMARK INSERT ERROR:",
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
      "BOOKMARK POST ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "북마크 저장 중 오류가 발생했습니다.",
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

    const driveFileId =
      searchParams.get("driveFileId");

    const episode =
      searchParams.get("episode");

    if (!driveFileId || !episode) {
      return Response.json(
        {
          error:
            "driveFileId와 episode가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const episodeNumber = Number(episode);

    if (!Number.isFinite(episodeNumber)) {
      return Response.json(
        { error: "episode 값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", session.user.email)
      .eq("drive_file_id", driveFileId)
      .eq("episode", episodeNumber);

    if (error) {
      console.error(
        "BOOKMARK DELETE ERROR:",
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
      "BOOKMARK DELETE ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "북마크 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}