import type { SignedInUser } from "./auth/current-user.ts";

/** Hono's typing for this Worker: its bindings, and what middleware puts on the context. */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    /** Set by `requireUser` for routes that need a signed-in User. */
    user: SignedInUser;
  };
};
