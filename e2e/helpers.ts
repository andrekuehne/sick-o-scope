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
