import { cookies } from "next/headers";
import { prisma } from "@/lib/db/opsconsole";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "ops_session";

export async function createSession(adminUserId: string, ip?: string, ua?: string) {
  const days = Number(process.env.SESSION_TTL_DAYS || 7);
  const token = randomToken(48);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await prisma.session.create({
    data: { adminUserId, tokenHash, ip, userAgent: ua, expiresAt },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
  return { token, expiresAt };
}

export async function getSession() {
  const c = (await cookies()).get(COOKIE);
  if (!c) return null;
  const tokenHash = sha256(c.value);
  const s = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
  return s;
}

export async function markSessionTotpVerified(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { totpVerified: true } });
}

export async function revokeCurrentSession() {
  const c = (await cookies()).get(COOKIE);
  if (c) {
    const tokenHash = sha256(c.value);
    await prisma.session.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
  }
  (await cookies()).delete(COOKIE);
}
