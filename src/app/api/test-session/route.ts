import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";

export async function GET() {
  const session: any = await getServerSession(authOptions);

  return Response.json({
    session,
  });
}