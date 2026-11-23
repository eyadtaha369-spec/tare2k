import "server-only";

/** Calls the Google Apps Script backend. Server-side only (holds the secret). */
export async function sheets<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new Error("Google Sheets backend is not configured.");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, action, payload }),
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Unexpected response from Google Sheets backend.");
  }
  if (data.error) throw new Error(data.error);
  return data;
}
