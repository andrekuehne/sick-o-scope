// A minimal D1Database for scripts: runs the Worker's own data code against the app's
// database through `wrangler d1 execute`, locally (the same files `npm run dev` uses)
// or remotely (production, via Cloudflare's REST API; needs `npx wrangler login`).
//
// Wrangler's remote-binding proxy (getPlatformProxy with remote: true) would be the
// natural tool, but it fails even for `SELECT 1` here, while `d1 execute` works.
//
// `d1 execute` takes no bound parameters, so values are inlined as SQL literals.
// That's safe for what scripts pass (ids, timestamps, hashes, names): strings are
// quoted with single quotes doubled, which is all SQLite string literals need.
// Statements must not contain `?` other than as placeholders.
//
// A batch runs as one multi-statement command. Locally that is all-or-nothing (checked:
// a failing third INSERT rolled back the first two). Remotely it goes through D1's
// query API, where that hasn't been checked; the setup command runs rarely and by hand.

import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

type Row = Record<string, unknown>;
type StatementResult = { results: Row[]; success: boolean; meta: { changes?: number } };

export type WranglerD1Options = { remote: boolean; persistTo?: string };

/** The app's D1 database (binding DB in wrangler.jsonc), shaped like a Worker's D1Database. */
export function wranglerD1(options: WranglerD1Options): D1Database {
  const execute = (statements: Statement[]): StatementResult[] => {
    const args = [
      WRANGLER,
      "d1",
      "execute",
      "DB",
      options.remote ? "--remote" : "--local",
      ...(options.persistTo ? ["--persist-to", options.persistTo] : []),
      "--config",
      path.join(ROOT, "wrangler.jsonc"),
      "--json",
      "--command",
      statements.map((s) => s.toSql()).join(";\n"),
    ];
    try {
      // No shell: the SQL reaches Wrangler as one argument, exactly as written.
      const stdout = execFileSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return JSON.parse(stdout) as StatementResult[];
    } catch (error) {
      throw new Error(`Database error: ${wranglerErrorText(error)}`);
    }
  };

  class Statement {
    readonly sql: string;
    readonly params: unknown[];
    constructor(sql: string, params: unknown[] = []) {
      this.sql = sql;
      this.params = params;
    }
    bind(...params: unknown[]) {
      return new Statement(this.sql, params);
    }
    toSql() {
      const placeholders = this.sql.match(/\?/g)?.length ?? 0;
      if (placeholders !== this.params.length) {
        throw new Error(`${placeholders} placeholders but ${this.params.length} values in: ${this.sql}`);
      }
      let i = 0;
      return this.sql.replace(/\?/g, () => sqlLiteral(this.params[i++]));
    }
    async run() {
      const [result] = execute([this]);
      return result;
    }
    async all() {
      return this.run();
    }
    async first(column?: string) {
      const row = (await this.run())?.results[0] ?? null;
      return column && row ? row[column] : row;
    }
  }

  const db = {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => execute(statements),
  };
  // Only the parts of D1Database that the Worker's data code uses are implemented.
  return db as unknown as D1Database;
}

/** Wrangler's own explanation (with --json it prints `{ error: { text, notes } }`), else the raw output. */
function wranglerErrorText(error: unknown): string {
  const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
  try {
    const { text, notes = [] } = (JSON.parse(stdout) as { error: { text: string; notes?: { text: string }[] } }).error;
    return [text, ...notes.map((n) => n.text)].join(" ");
  } catch {
    return (stderr || stdout || String(error)).trim();
  }
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error(`Can't inline ${typeof value} as SQL`);
}
