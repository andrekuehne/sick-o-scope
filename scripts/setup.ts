// The setup command (ADR 0002): creates a Family with its first User and prints a
// Sign-in link, or prints a fresh Sign-in link for an existing User (the way back in
// when nobody in the Family can sign in any more). It runs the Worker's own code
// against the app's database, locally or in production (see scripts/wrangler-d1.ts).
//
//   npm run setup -- family --family "Familie Kühne" --user "André"
//   npm run setup -- link --user "André"
//   add --remote --base-url <app URL> for production, see README.

import { parseArgs } from "node:util";
import { createSignInLink, signInLinkUrl } from "../src/worker/auth/sign-in-links.ts";
import { createFamilyWithFirstUser } from "../src/worker/family-setup.ts";
import { wranglerD1 } from "./wrangler-d1.ts";

const USAGE = `Usage:
  node scripts/setup.ts family --family <family name> --user <user name> [options]
  node scripts/setup.ts link --user <user name> [options]

Options:
  --remote            use the production database (needs \`npx wrangler login\`)
  --base-url <url>    where the app runs (default: http://localhost:5173)
  --persist-to <dir>  local database directory (default: Wrangler's, as in \`npm run dev\`)`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    family: { type: "string" },
    user: { type: "string" },
    remote: { type: "boolean", default: false },
    "base-url": { type: "string", default: "http://localhost:5173" },
    "persist-to": { type: "string" },
  },
});

const command = positionals[0];
const userName = values.user?.trim();
const familyName = values.family?.trim();
if (!userName || (command === "family" && !familyName) || (command !== "family" && command !== "link")) {
  console.error(USAGE);
  process.exit(1);
}

const db = wranglerD1({ remote: values.remote, persistTo: values["persist-to"] });
try {
  const { familyId, userId } =
    command === "family" && familyName
      ? await createFamilyWithFirstUser(db, { familyName, userName })
      : await findUser(db, userName);
  if (command === "family") console.log(`Created Family "${familyName}" with first User "${userName}".`);

  const link = await createSignInLink(db, { familyId, forUserId: userId });
  console.log(`\nSign-in link for ${userName}, valid once until ${link.expiresAt.toLocaleString("de-DE")}:\n`);
  console.log(signInLinkUrl(values["base-url"], link.token));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

/** The one User with this name; refuses to guess when the name is missing or ambiguous. */
async function findUser(binding: D1Database, name: string) {
  const { results } = await binding
    .prepare(
      `SELECT u.id AS user_id, fu.family_id FROM users u JOIN family_users fu ON fu.user_id = u.id
       WHERE u.display_name = ?`,
    )
    .bind(name)
    .all<{ user_id: string; family_id: string }>();
  const [only, ...others] = results;
  if (!only) throw new Error(`No User named "${name}".`);
  if (others.length > 0) throw new Error(`Several Users are named "${name}"; rename one first.`);
  return { familyId: only.family_id, userId: only.user_id };
}
