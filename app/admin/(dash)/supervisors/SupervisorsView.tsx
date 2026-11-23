"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Trash2, UserPlus } from "lucide-react";

type User = { id: string; name: string; username: string; is_active: boolean; created_at: string; created_by: string };

export default function SupervisorsView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/supervisors", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error);
    setUsers(j.users ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy("create");
    setError(null);
    setNotice(null);
    const r = await fetch("/api/admin/supervisors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd)),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return setError(j.error);
    form.reset();
    setNotice(`Supervisor "${j.user.name}" created. They can log in at /admin/login with username "${j.user.username}".`);
    setUsers((u) => [j.user, ...u]);
  }

  async function toggle(u: User) {
    setBusy(u.id);
    const r = await fetch(`/api/admin/supervisors/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.is_active }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return setError(j.error);
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, is_active: j.user.is_active } : x)));
  }

  async function remove(u: User) {
    if (!confirm(`Delete supervisor "${u.name}"? They will lose access immediately.`)) return;
    setBusy(u.id);
    const r = await fetch(`/api/admin/supervisors/${u.id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) return setError((await r.json()).error);
    setUsers((list) => list.filter((x) => x.id !== u.id));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black">Supervisors</h1>
      <p className="mb-5 text-sm text-neutral-500">المشرفين — supervisors can only open the QR Scanner.</p>

      <form onSubmit={create} className="card mb-6 space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><UserPlus size={18} /> Add supervisor | إضافة مشرف</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="name">Name <span className="label-ar">اسم المشرف</span></label>
            <input id="name" name="name" required minLength={2} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="username">Username / Email</label>
            <input id="username" name="username" required minLength={3} className="input" autoCapitalize="none" autoComplete="off" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password <span className="label-ar">كلمة السر</span></label>
            <div className="relative">
              <input id="password" name="password" type={showPw ? "text" : "password"} required minLength={6}
                className="input pr-10" autoComplete="new-password" dir="ltr" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-3 text-neutral-400" aria-label="Show password">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>
        {error && <div className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}
        {notice && <div className="rounded-xl bg-emerald-100 p-3 text-sm font-semibold text-emerald-800">{notice}</div>}
        <button className="btn-primary" disabled={busy === "create"}>
          {busy === "create" && <Loader2 size={16} className="animate-spin" />} Create supervisor
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-neutral-400" /></div>
      ) : users.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500">No supervisors yet. | لا يوجد مشرفين.</div>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{u.name}</span>
                  {u.is_active ? (
                    <span className="chip bg-emerald-100 text-emerald-800">Active | نشط</span>
                  ) : (
                    <span className="chip bg-neutral-200 text-neutral-600">Deactivated | موقوف</span>
                  )}
                </div>
                <div className="font-mono text-sm text-neutral-500" dir="ltr">{u.username}</div>
                <div className="text-xs text-neutral-400">
                  Added {new Date(u.created_at).toLocaleDateString("en-GB", { timeZone: "Africa/Cairo" })}
                  {u.created_by && ` by ${u.created_by}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggle(u)} disabled={busy === u.id} role="switch" aria-checked={u.is_active}
                  className={`relative h-7 w-12 rounded-full transition ${u.is_active ? "bg-emerald-500" : "bg-neutral-300"}`}
                  title={u.is_active ? "Deactivate" : "Activate"}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${u.is_active ? "left-6" : "left-1"}`} />
                </button>
                <button onClick={() => remove(u)} disabled={busy === u.id} className="btn-ghost !px-3 !py-2 text-red-700" title="Delete">
                  {busy === u.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
