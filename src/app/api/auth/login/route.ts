import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/opsconsole";
import { createSession, markSessionTotpVerified } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  const user = await prisma.adminUser.findUnique({ where: { email } });
  // Constant-time-ish: confronto sempre, così l'attaccante non distingue user/pwd errata.
  const dummyHash = "$2a$10$0000000000000000000000000000000000000000000000000000";
  const ok = user?.passwordHash
    ? await bcrypt.compare(parsed.data.password, user.passwordHash)
    : (await bcrypt.compare(parsed.data.password, dummyHash), false);

  if (!ok || !user) {
    await audit({ actor: email, action: "login.password.fail", ip, userAgent: ua });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { token } = await createSession(user.id, ip, ua);
  // Sessione marcata come "verified" per bypassare il check TOTP delle pagine dashboard.
  const session = await prisma.session.findFirst({
    where: { adminUserId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (session) await markSessionTotpVerified(session.id);

  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actor: email, action: "login.password.ok", ip, userAgent: ua });

  return NextResponse.json({ ok: true });
}
