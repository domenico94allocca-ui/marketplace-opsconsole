import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/opsconsole";
import { generateTotpSecret, totpUri, encryptSecret } from "@/lib/auth/totp";
import { TotpForm } from "./TotpForm";

export const dynamic = "force-dynamic";

export default async function TotpPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  let qrDataUrl: string | null = null;
  let secretPlain: string | null = null;

  if (!s.user.totpEnabledAt) {
    // Enrollment: genera secret e mostra QR. Il secret resta in memoria fino alla conferma.
    secretPlain = generateTotpSecret();
    // Salviamo provvisoriamente cifrato; verrà "abilitato" solo dopo conferma del primo codice.
    await prisma.adminUser.update({
      where: { id: s.user.id },
      data: { totpSecret: encryptSecret(secretPlain) },
    });
    const uri = totpUri(secretPlain, s.user.email);
    qrDataUrl = await QRCode.toDataURL(uri);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        {!s.user.totpEnabledAt ? (
          <>
            <h1 className="text-xl font-semibold mb-2">Configura TOTP</h1>
            <p className="text-sm text-neutral-500 mb-4">
              Scansiona il QR con Google Authenticator, 1Password o Authy. Poi inserisci il codice a 6 cifre per confermare.
            </p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR TOTP" className="mx-auto bg-white p-2 rounded mb-4 w-56 h-56" />
            )}
            {secretPlain && (
              <div className="text-xs text-neutral-500 mb-4 break-all">
                Codice manuale: <code className="text-neutral-300">{secretPlain}</code>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-2">Inserisci codice TOTP</h1>
            <p className="text-sm text-neutral-500 mb-4">Codice a 6 cifre dall&apos;app authenticator.</p>
          </>
        )}
        <TotpForm enrolling={!s.user.totpEnabledAt} />
      </div>
    </div>
  );
}
