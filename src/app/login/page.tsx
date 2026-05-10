"use client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-semibold mb-2">OpsConsole</h1>
        <p className="text-sm text-neutral-500 mb-6">Console operativa privata BacoliOnLife.</p>
        {sent ? (
          <div className="text-sm">
            Se l&apos;email è autorizzata riceverai un link entro pochi secondi. Il link scade in 10 minuti.
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-sm text-neutral-400">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tuo@email.it"
              autoFocus
            />
            <button className="btn-primary mt-2" disabled={loading}>
              {loading ? "Invio…" : "Invia magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
