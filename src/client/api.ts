// The client's only way to talk to the Worker. Responses are validated with the
// shared schemas, so a mismatch fails loudly here instead of deep in a component.

import { z } from "zod";
import { Me, SignInFailure } from "../shared/auth.ts";
import {
  CheckIn,
  type CheckInStateInput,
  type FillGapsRequest,
  FillGapsResult,
} from "../shared/check-ins.ts";
import { Member, type MemberInput } from "../shared/members.ts";
import { FamilyUsers, SignInLinkCreated, type SignInLinkRequest } from "../shared/users.ts";

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
const familyPath = (familyId: string) => `/api/families/${encodeURIComponent(familyId)}`;
const membersPath = (familyId: string) => `${familyPath(familyId)}/members`;

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

const checkInsPath = (familyId: string) => `${familyPath(familyId)}/check-ins`;

/** The Family's Check-ins from `from` to `to`, both included. */
export async function fetchCheckIns(familyId: string, from: string, to: string): Promise<CheckIn[]> {
  const res = await fetch(`${checkInsPath(familyId)}?from=${from}&to=${to}`);
  if (!res.ok) throw new Error(`GET check-ins failed: ${res.status}`);
  return z.object({ checkIns: z.array(CheckIn) }).parse(await res.json()).checkIns;
}

/** Saves a Member's day as this complete state, replacing what was there. */
export async function saveCheckIn(
  familyId: string,
  date: string,
  memberId: string,
  state: CheckInStateInput,
): Promise<CheckIn> {
  return CheckIn.parse(await sendJson("PUT", `${checkInsPath(familyId)}/${date}/${encodeURIComponent(memberId)}`, state));
}

/** Turns a Member's day back into a Gap. */
export async function deleteCheckIn(familyId: string, date: string, memberId: string): Promise<void> {
  const res = await fetch(`${checkInsPath(familyId)}/${date}/${encodeURIComponent(memberId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE check-in failed: ${res.status}`);
}

/** Writes these Check-ins only where a Member has none for that date yet. */
export async function fillGaps(familyId: string, checkIns: FillGapsRequest["checkIns"]): Promise<FillGapsResult> {
  return FillGapsResult.parse(await sendJson("POST", `${checkInsPath(familyId)}/fill-gaps`, { checkIns }));
}

/** The Family's Users, each with their signed-in Devices. */
export async function fetchFamilyUsers(familyId: string): Promise<FamilyUsers["users"]> {
  const res = await fetch(`${familyPath(familyId)}/users`);
  if (!res.ok) throw new Error(`GET users failed: ${res.status}`);
  return FamilyUsers.parse(await res.json()).users;
}

/** Gerät hinzufügen: a new Sign-in link, whose URL exists only in this answer. */
export async function createSignInLink(familyId: string, forWhom: SignInLinkRequest): Promise<SignInLinkCreated> {
  return SignInLinkCreated.parse(await sendJson("POST", `${familyPath(familyId)}/sign-in-links`, forWhom));
}

/** Signs out any Device of the Family. */
export async function signOutFamilyDevice(familyId: string, deviceId: string): Promise<void> {
  const res = await fetch(`${familyPath(familyId)}/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE device failed: ${res.status}`);
}

/** Removes a User from the Family, signing out all their Devices. */
export async function removeUser(familyId: string, userId: string): Promise<void> {
  const res = await fetch(`${familyPath(familyId)}/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE user failed: ${res.status}`);
}

/** Where the Family's Check-ins download as a CSV file. */
export function exportCsvUrl(familyId: string): string {
  return `${familyPath(familyId)}/export.csv`;
}
