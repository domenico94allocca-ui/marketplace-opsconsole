import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { issueMagicLink } from "@/lib/auth/magic-link";
import { audit } from "@/lib/audit/log";

const Body = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const ua = req.headers.get("user-agent") || undefined;
  await issueMagicLink(parsed.data.email, ip, ua);
  await audit({ actor: parsed.data.email, action: "login.magic.request", ip, userAgent: ua });
  return NextResponse.json({ ok: true });
}
