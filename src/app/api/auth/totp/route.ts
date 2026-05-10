import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession, markSessionTotpVerified } from "@/lib/auth/session";
import { prisma } from "@/lib/db/opsconsole";
import { decryptSecret, verifyTotp } from "@/lib/auth/totp";
import { audit } from "@/lib/audit/log";

const Body = z.object({ code: z.string().regex(/^\d{6}$/), enrolling: z.boolean() });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "no_session" }, { status: 401 });
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (!s.user.totpSecret) return NextResponse.json({ error: "no_secret" }, { status: 400 });
  const secret = decryptSecret(s.user.totpSecret);
  const ok = verifyTotp(secret, parsed.data.code);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  if (!ok) {
    await audit({ actor: s.user.email, action: "login.totp.fail", ip, userAgent: ua });
    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  if (parsed.data.enrolling) {
    await prisma.adminUser.update({
      where: { id: s.user.id },
      data: { totpEnabledAt: new Date() },
    });
  }
  await markSessionTotpVerified(s.id);
  await prisma.adminUser.update({ where: { id: s.user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actor: s.user.email, action: parsed.data.enrolling ? "login.totp.enroll" : "login.totp.ok", ip, userAgent: ua });
  return NextResponse.json({ ok: true });
}
