// Secrets handed to people or browsers (Sign-in link and session tokens).
// They are random enough to be unguessable, and only their hashes are stored.

/** A new unguessable token: 32 random bytes, base64url-encoded (43 characters). */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** The SHA-256 hash (hex) under which a token is stored and looked up. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
