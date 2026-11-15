// The client's only way to talk to the Worker. Responses are validated with the
// shared schemas, so a mismatch fails loudly here instead of deep in a component.

import { Me, SignInFailure } from "../shared/auth.ts";
import { Member, type MemberInput } from "../shared/members.ts";

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

/** Sends JSON to the API and returns the parsed answer; anything but 2xx is an error. */
async function sendJson(method: "POST" | "PUT", path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return res.json();
}

const membersPath = (familyId: string) => `/api/families/${encodeURIComponent(familyId)}/members`;

export async function addMember(familyId: string, input: MemberInput): Promise<Member> {
  return Member.parse(await sendJson("POST", membersPath(familyId), input));
}

export async function updateMember(familyId: string, memberId: string, input: MemberInput): Promise<Member> {
  return Member.parse(await sendJson("PUT", `${membersPath(familyId)}/${encodeURIComponent(memberId)}`, input));
}

/** Puts the active Members in this order (every active Member's id, exactly once). */
export async function reorderMembers(familyId: string, memberIds: string[]): Promise<void> {
  await sendJson("PUT", `${membersPath(familyId)}/order`, { memberIds });
}

export async function setMemberArchived(familyId: string, memberId: string, archived: boolean): Promise<Member> {
  const action = archived ? "archive" : "unarchive";
  return Member.parse(await sendJson("POST", `${membersPath(familyId)}/${encodeURIComponent(memberId)}/${action}`));
}
