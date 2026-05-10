"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError("Credenziali non valide.");
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-semibold mb-2">OpsConsole</h1>
        <p className="text-sm text-neutral-500 mb-6">Console operativa privata BacoliOnLife.</p>
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
            autoComplete="username"
          />
          <label className="text-sm text-neutral-400 mt-2">Password</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <div className="text-sm text-red-500">{error}</div>}
          <button className="btn-primary mt-2" disabled={loading}>
            {loading ? "Accesso…" : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}
