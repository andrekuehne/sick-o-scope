// The client's only way to talk to the Worker. Responses are validated with the
// shared schemas, so a mismatch fails loudly here instead of deep in a component.

import { Me, SignInFailure } from "../shared/auth.ts";

/** Who is signed in on this Device, or null when nobody is (or the session ended). */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch("/api/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /api/me failed: ${res.status}`);
  return Me.parse(await res.json());
}

export type SignInResult = { ok: true; me: Me } | { ok: false; reason: SignInFailure["error"] };

/** Redeems a Sign-in link's token; on success this Device is signed in. */
export async function signIn(token: string): Promise<SignInResult> {
  const res = await fetch("/api/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (res.ok) return { ok: true, me: Me.parse(await res.json()) };
  if (res.status === 400 || res.status === 410) {
    return { ok: false, reason: SignInFailure.parse(await res.json()).error };
  }
  throw new Error(`POST /api/sign-in failed: ${res.status}`);
}

/** Signs this Device out. */
export async function signOut(): Promise<void> {
  const res = await fetch("/api/sign-out", { method: "POST" });
  if (!res.ok) throw new Error(`POST /api/sign-out failed: ${res.status}`);
}
