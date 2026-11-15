import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { E2E_BASE_URL, E2E_STATE_DIR } from "./env.ts";

const run = promisify(execFile);

/**
 * Creates a new Family with its first User in the end-to-end database, using the
 * setup command exactly as a person would, and returns the Sign-in link it prints.
 */
export async function newFamilySignInLink(familyName: string, userName: string): Promise<string> {
  const { stdout } = await run(
    process.execPath,
    [
      "scripts/setup.ts",
      "family",
      "--family",
      familyName,
      "--user",
      userName,
      "--persist-to",
      E2E_STATE_DIR,
      "--base-url",
      E2E_BASE_URL,
    ],
    { encoding: "utf8" },
  );
  const link = stdout.match(/https?:\/\/\S+\/anmelden#\S+/)?.[0];
  if (!link) throw new Error(`setup printed no Sign-in link:\n${stdout}`);
  return link;
}

/** Signs in a new Family's first User in this page and adds Members through the app's own API. */
export async function signedInWithMembers(page: import("@playwright/test").Page, memberNames: string[]) {
  await page.goto(await newFamilySignInLink("Familie Kühne", "André"));
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("heading", { name: "Hallo André 👋" }).waitFor();
  await page.evaluate(async (names) => {
    const me = (await (await fetch("/api/me")).json()) as { family: { id: string } };
    for (const [i, name] of names.entries()) {
      const res = await fetch(`/api/families/${me.family.id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, emoji: ["🦊", "🐻", "🐰", "🐸"][i % 4], colour: "#ff7a59" }),
      });
      if (!res.ok) throw new Error(`adding ${name} failed: ${res.status}`);
    }
  }, memberNames);
  await page.reload();
}

/** Saves a Check-in `daysAgo` days before the phone's today, as another Device would. */
export async function logDay(page: import("@playwright/test").Page, memberName: string, daysAgo: number, state: object) {
  await page.evaluate(
    async ({ memberName, daysAgo, state }) => {
      const me = (await (await fetch("/api/me")).json()) as {
        family: { id: string };
        members: { id: string; name: string }[];
      };
      const member = me.members.find((m) => m.name === memberName);
      const day = new Date();
      day.setDate(day.getDate() - daysAgo);
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/families/${me.family.id}/check-ins/${date}/${member?.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error(`logging ${memberName} failed: ${res.status}`);
    },
    { memberName, daysAgo, state },
  );
}
