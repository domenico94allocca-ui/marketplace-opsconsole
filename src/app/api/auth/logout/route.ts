import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";

export async function POST() {
  await revokeCurrentSession();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3100"));
}
