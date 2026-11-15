import { z } from "zod";
import { Member } from "./members.ts";

/** Body of `POST /api/sign-in`: the token from the Sign-in link's fragment. */
export const SignInRequest = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export type SignInRequest = z.infer<typeof SignInRequest>;

/** Why a Sign-in link didn't work. */
export const SignInFailure = z.object({
  error: z.enum(["unknown", "used", "expired"]),
});
export type SignInFailure = z.infer<typeof SignInFailure>;

/** Answer of `GET /api/me` (and of a successful sign-in): who is signed in, their Family and its Members. */
export const Me = z.object({
  user: z.object({ id: z.string(), name: z.string() }),
  family: z.object({ id: z.string(), name: z.string() }),
  members: z.array(Member),
});
export type Me = z.infer<typeof Me>;
