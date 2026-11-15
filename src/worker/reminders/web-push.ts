// Web Push without content (RFC 8030), identified with VAPID (RFC 8292). Without a payload
// nothing needs encrypting: the push only wakes the service worker, which shows a fixed text
// (public/push-sw.js). So no health data ever travels through the push service.

import type { PushOutcome, SendPush } from "./reminder-job.ts";

export type VapidKeys = {
  /** The P-256 public key, uncompressed and base64url-encoded, as browsers take it. */
  publicKey: string;
  /** The private key's `d`, base64url-encoded. */
  privateKey: string;
  /** Who runs this app: a URL the push service may use as a contact. */
  subject: string;
};

/** A push older than this is useless as a Reminder, so the push service may drop it. */
const TIME_TO_LIVE_SECONDS = 30 * 60;

/** Sends pushes to endpoints, signed with these VAPID keys. */
export function webPushSender(keys: VapidKeys): SendPush {
  const signingKey = importSigningKey(keys);
  return async (endpoint: string): Promise<PushOutcome> => {
    const jwt = await vapidJwt(await signingKey, new URL(endpoint).origin, keys.subject, new Date());
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
        ttl: String(TIME_TO_LIVE_SECONDS),
        // A Reminder belongs to a time of day: Android delivers it even while the phone dozes.
        urgency: "high",
      },
      body: "",
    });
    if (res.ok) return "sent";
    if (res.status === 404 || res.status === 410) return "gone";
    console.error(`push failed: ${res.status} ${await res.text()}`);
    return "failed";
  };
}

function importSigningKey({ publicKey, privateKey }: VapidKeys): Promise<CryptoKey> {
  const point = base64UrlDecode(publicKey);
  if (point.length !== 65 || point[0] !== 4) throw new Error("VAPID public key isn't an uncompressed P-256 point");
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(point.slice(1, 33)),
      y: base64UrlEncode(point.slice(33, 65)),
      d: privateKey,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** The VAPID token for one push service: an ES256 JWT, valid for 12 hours. */
async function vapidJwt(key: CryptoKey, audience: string, subject: string, now: Date): Promise<string> {
  const json = (value: object) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
  const exp = Math.floor(now.getTime() / 1000) + 12 * 60 * 60;
  const unsigned = `${json({ typ: "JWT", alg: "ES256" })}.${json({ aud: audience, exp, sub: subject })}`;
  // WebCrypto's ECDSA signature is r ‖ s, which is exactly what ES256 wants.
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
