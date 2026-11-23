"use client";
import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { browserClient } from "@/lib/supabase-browser";

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const { error } = await browserClient().auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="" width={48} height={48} className="rounded-full" />
          <div>
            <div className="text-xl font-black tracking-wider text-brand-600">TARE2K</div>
            <div className="text-xs font-semibold text-neutral-500">Admin & Supervisors | لوحة الإدارة</div>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
        </div>
        {error && <div className="rounded-lg bg-red-100 p-2.5 text-sm font-semibold text-red-800">{error}</div>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} Sign in
        </button>
      </form>
    </main>
  );
}
