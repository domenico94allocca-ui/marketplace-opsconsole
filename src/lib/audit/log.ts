import { prisma } from "@/lib/db/opsconsole";

export async function audit(opts: {
  actor: string;
  action: string;
  target?: string;
  payload?: unknown;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actor: opts.actor,
        action: opts.action,
        target: opts.target,
        payload: opts.payload as never,
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    });
  } catch (e) {
    // Non bloccante: log su stderr
    // eslint-disable-next-line no-console
    console.error("[ops][audit] failed", e);
  }
}
