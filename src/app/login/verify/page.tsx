import { redirect } from "next/navigation";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Verify({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/login?err=missing_token");
  const r = await consumeMagicLink(token);
  if (!r.ok) redirect(`/login?err=${r.reason}`);

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const ua = h.get("user-agent") || undefined;
  await createSession(r.user.id, ip, ua);
  await audit({ actor: r.user.email, action: "login.magic.consume", ip, userAgent: ua });

  // Se TOTP non ancora configurato, va all'enroll, altrimenti chiede il codice.
  redirect("/login/totp");
}
