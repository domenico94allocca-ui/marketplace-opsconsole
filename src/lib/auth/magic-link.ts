import { Resend } from "resend";
import { prisma } from "@/lib/db/opsconsole";
import { randomToken, sha256 } from "./crypto";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function issueMagicLink(email: string, ip?: string, ua?: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || email.toLowerCase() !== adminEmail) {
    // Risposta generica per non rivelare l'email autorizzata.
    return { ok: true };
  }
  let user = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!user) user = await prisma.adminUser.create({ data: { email: adminEmail } });

  const ttlMin = Number(process.env.MAGIC_LINK_TTL_MIN || 10);
  const token = randomToken(48);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + ttlMin * 60_000);

  await prisma.magicLink.create({
    data: { adminUserId: user.id, tokenHash, ip, userAgent: ua, expiresAt },
  });

  const domain = process.env.OPS_DOMAIN || "ops.bacolionlife.it";
  const link = `https://${domain}/login/verify?token=${token}`;
  const from = process.env.EMAIL_FROM || `ops@${domain}`;

  if (resend) {
    await resend.emails.send({
      from,
      to: adminEmail,
      subject: "OpsConsole - Link di accesso",
      text: `Apri questo link entro ${ttlMin} minuti per accedere:\n\n${link}\n\nIP richiesta: ${ip ?? "n/d"}\nUser-Agent: ${ua ?? "n/d"}\n\nSe non hai richiesto l'accesso, ignora questo messaggio.`,
    });
  } else {
    // Dev: stampa il link in console.
    // eslint-disable-next-line no-console
    console.log("[ops][dev] Magic link:", link);
  }

  return { ok: true };
}

export async function consumeMagicLink(token: string) {
  const tokenHash = sha256(token);
  const link = await prisma.magicLink.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!link) return { ok: false as const, reason: "not_found" as const };
  if (link.consumedAt) return { ok: false as const, reason: "consumed" as const };
  if (link.expiresAt < new Date()) return { ok: false as const, reason: "expired" as const };
  await prisma.magicLink.update({ where: { id: link.id }, data: { consumedAt: new Date() } });
  return { ok: true as const, user: link.user };
}
