import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: Request
) {
  const session: any =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json(
      {
        error: "로그인이 필요합니다.",
      },
      { status: 401 }
    );
  }

  const userId = session.user.email;

  try {
    const body = await request.json();

    const {
      bookId,
      isRereadWanted,
      isExcluded,
    } = body;

    if (!bookId) {
      return Response.json(
        {
          error: "bookId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (
      typeof isRereadWanted !==
        "boolean" ||
      typeof isExcluded !== "boolean"
    ) {
      return Response.json(
        {
          error:
            "관리 상태 값이 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabase
        .from("books")
        .update({
          is_reread_wanted:
            isRereadWanted,
          is_excluded: isExcluded,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", bookId)
        .eq("user_id", userId)
        .select(
          "id,is_reread_wanted,is_excluded"
        )
        .single();

    if (error) {
      console.error(
        "BOOK MANAGEMENT UPDATE ERROR:",
        error
      );

      return Response.json(
        {
          error: error.message,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "BOOK MANAGEMENT ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "관리 상태를 저장하지 못했습니다.",
      },
      { status: 500 }
    );
  }
}