# sick-o-scope

A playful family sickness tracker. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for the architecture decisions.

A React + Vite PWA served by one Cloudflare Worker, with a Hono JSON API on `/api/*` and D1 (EU jurisdiction) for storage:

- `src/client/`: the React app (screens, UI strings in `strings.ts`, styles).
- `src/worker/`: the Worker; it only ever handles `/api/*`, everything else is served as static assets with a fallback to the app.
- `src/shared/`: code and Zod schemas used by both.
- `public/icons/`: placeholder app icons, rendered by `npm run icons`.

## Development

### Prerequisites

- Node.js 24 and npm 11.19 or newer (npm gates install scripts; the approved ones are listed under `allowScripts` in `package.json`).
- A Cloudflare account, only needed for deploying and the remote database.

Everything else (Vite, Wrangler, Vitest, Playwright, TypeScript) is a project dev dependency. Nothing is installed globally. For the end-to-end tests, download their browser once: `npx playwright install chromium`.

### First-time setup

```sh
npm install
npm run db:migrate:local   # create the local D1 database and apply migrations
npm run dev                # http://localhost:5173, app and API together
```

To sign in locally, create a Family and open the printed link (see "Signing in" below):

```sh
npm run setup -- family --family "Familie Test" --user "André"
```

For deploying by hand, sign in to Cloudflare once: `npx wrangler login`.

### Daily commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload; the Worker runs in the local Workers runtime with a local D1 (stored in `.wrangler/`). |
| `npm test` | Runs the API tests inside the Workers runtime against a freshly migrated local D1. |
| `npm run test:watch` | Same, in watch mode. |
| `npm run test:e2e` | Builds the app and runs the Playwright tests against it (phone-sized Chromium). |
| `npm run typecheck` | Type-checks Worker, client, tests and tooling. |
| `npm run build` | Production build into `dist/` (client assets plus the Worker). |
| `npm run preview` | Builds, then serves the production build locally, as deployed. |
| `npm run db:migrate:local` | Applies new migrations to the local D1 database. |
| `npm run db:migrate:remote` | Applies new migrations to the production D1 database. |
| `npm run deploy` | Builds and deploys by hand. Apply remote migrations first. Normally CI does both. |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc`. |
| `npm run icons` | Re-renders the placeholder app icons. |
| `npm run setup -- …` | Creates a Family or a fresh Sign-in link (see "Signing in"). |

## Signing in

There are no passwords or emails: a Device signs in by opening a one-time Sign-in link (ADR 0002). Links are valid for 24 hours. A signed-in Device stays signed in as long as it is used at least once a year.

The setup command creates the first Family and its first User, and is also the way back in when nobody in a Family can sign in any more:

```sh
# A new Family with its first User, plus a Sign-in link for them:
npm run setup -- family --family "Familie Kühne" --user "André"
# A fresh Sign-in link for an existing User:
npm run setup -- link --user "André"
```

Both work on the local database by default. For production, add `--remote --base-url https://sick-o-scope.mail-4a4.workers.dev` (needs `npx wrangler login`), for example a fresh Sign-in link for a signed-out User:

```sh
npm run setup -- link --user "André" --remote --base-url https://sick-o-scope.mail-4a4.workers.dev
```

The command runs the Worker's own code through `wrangler d1 execute` (`scripts/wrangler-d1.ts` explains why not Wrangler's remote bindings).

## Database migrations

Plain SQL files in `migrations/`, applied in order. Create one with:

```sh
npx wrangler d1 migrations create DB <short_description>
```

Tests apply all migrations before each test file, in their own isolated storage.

The scripts pass `--config wrangler.jsonc` explicitly: after a build, Wrangler would otherwise follow the build's redirect (`.wrangler/deploy/config.json`) to the generated config in `dist/`.

Migrations must be additive (add tables and columns; drop or rename only in a later release), because CI applies them before the new code goes live, so the old code briefly runs against the new schema.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): every push and pull request runs the typecheck, the API tests, a production build and the end-to-end tests. A push to `main` that passes all of them then applies the remote migrations, builds, and deploys.

The deploy job runs in the GitHub environment `production` (Settings → Environments), which needs three secrets:

- `CLOUDFLARE_ACCOUNT_ID`: shown by `npx wrangler whoami`.
- `CLOUDFLARE_API_TOKEN`: Cloudflare dashboard → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**, add **Account → D1 → Edit**, remove the zone row, limit to this account.

- `VAPID_PRIVATE_KEY`: see [Reminders](#reminders); the deploy hands it to the Worker as a secret.

Set them with `gh secret set CLOUDFLARE_API_TOKEN --env production` (and the same for the others).

## Reminders

Each Device can get a daily push notification (Einstellungen → Erinnerung). A Cron Trigger (`wrangler.jsonc` → `triggers`) runs every 15 minutes and sends the Reminders that are due (`src/worker/reminders/`). The pushes carry no content: the service worker shows a fixed text (`public/push-sw.js`), so no health data goes through the browsers' push services.

Pushes are signed with a VAPID key pair. The public key is `VAPID_PUBLIC_KEY` in `wrangler.jsonc`; the private key (the P-256 key's `d`, base64url) is the Worker secret `VAPID_PRIVATE_KEY`, kept in the GitHub environment `production`. Without it, the job logs a warning and sends nothing (as in local development; copy `.dev.vars.example` to `.dev.vars` to set one there).

To replace the key pair, generate a new one, put the public key into `wrangler.jsonc` and the private one into `production`, and deploy. Existing subscriptions belong to the old key, so every Device has to switch its Reminder off and on again.

Reminders only work where the service worker runs, which is in production builds (`npm run preview` or the deployed app), and need notification permission on the phone.
