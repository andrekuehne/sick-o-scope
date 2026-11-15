// Users and their Devices, as Einstellungen shows and manages them (GLOSSARY.md).

import { z } from "zod";

export const USER_NAME_MAX_LENGTH = 40;

/** A User's display name, as entered for a new User. */
export const UserName = z.string().trim().min(1).max(USER_NAME_MAX_LENGTH);

/** Who a new Sign-in link signs in (Gerät hinzufügen): an existing User of the Family (a new phone), or a new User. */
export const SignInLinkRequest = z.union([
  z.object({ forUserId: z.string() }).strict(),
  z.object({ newUserName: UserName }).strict(),
]);
export type SignInLinkRequest = z.infer<typeof SignInLinkRequest>;

/** A new Sign-in link. The URL holds the raw token, so this is the only time it exists. */
export const SignInLinkCreated = z.object({ url: z.string(), expiresAt: z.string() });
export type SignInLinkCreated = z.infer<typeof SignInLinkCreated>;

export const Device = z.object({
  id: z.string(),
  /** Like "Android · Chrome". */
  label: z.string(),
  lastSeenAt: z.string(),
  /** The Device this request came from. */
  isThisDevice: z.boolean(),
});
export type Device = z.infer<typeof Device>;

/** Answer of listing a Family's Users: each with their signed-in Devices. */
export const FamilyUsers = z.object({
  users: z.array(
    z.object({ id: z.string(), name: z.string(), isMe: z.boolean(), devices: z.array(Device) }),
  ),
});
export type FamilyUsers = z.infer<typeof FamilyUsers>;
