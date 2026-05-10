"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TotpForm({ enrolling }: { enrolling: boolean }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/auth/totp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, enrolling }),
    });
    if (res.ok) router.push("/");
    else { const j = await res.json().catch(() => ({})); setErr(j.error || "Codice non valido"); }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        className="input tracking-widest text-center text-lg"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        required
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        autoFocus
      />
      {err && <div className="text-err text-sm">{err}</div>}
      <button className="btn-primary" disabled={loading}>
        {loading ? "Verifica…" : enrolling ? "Conferma e attiva" : "Accedi"}
      </button>
    </form>
  );
}
