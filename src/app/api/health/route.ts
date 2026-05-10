import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, app: "opsconsole", version: process.env.npm_package_version || "0.1.0" });
}
