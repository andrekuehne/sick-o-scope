# sick-o-scope

A React + Vite PWA served by one Cloudflare Worker, with a Hono JSON API on `/api/*` and D1 for storage. See `docs/adr/` for why it differs from `lauf-register`.

## Development

### Prerequisites

- Node.js 24 and npm 11.19 or newer (npm gates install scripts; the approved ones are listed under `allowScripts` in `package.json`).
- A Cloudflare account, only needed for deploying and the remote database.

Everything else (Wrangler, Vitest, TypeScript) is a project dev dependency. Nothing is installed globally.

### First-time setup

```sh
npm install
npm run db:migrate:local   # create the local D1 database and apply migrations
npm run dev                # http://localhost:8787
```

For deploying by hand, sign in to Cloudflare once: `npx wrangler login`.

### Daily commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server with a local D1 database (stored in `.wrangler/`). |
| `npm test` | Runs the tests inside the Workers runtime against a freshly migrated local D1. |
| `npm run test:watch` | Same, in watch mode. |
| `npm run typecheck` | Type-checks app and tests. |
| `npm run db:migrate:local` | Applies new migrations to the local D1 database. |
| `npm run db:migrate:remote` | Applies new migrations to the production D1 database. |
| `npm run deploy` | Deploys the Worker by hand. Apply remote migrations first. Normally CI does both. |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc`. |

## Database migrations

Plain SQL files in `migrations/`, applied in order. Create one with:

```sh
npx wrangler d1 migrations create DB <short_description>
```

Tests apply all migrations before each test file, in their own isolated storage.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): every push and pull request runs `npm ci`, `npm run typecheck` and `npm test`. A push to `main` that passes then runs `npm run db:migrate:remote` and `npm run deploy`.

The deploy job runs in the GitHub environment `production` (Settings → Environments), which needs two secrets:

- `CLOUDFLARE_ACCOUNT_ID`: shown by `npx wrangler whoami`.
- `CLOUDFLARE_API_TOKEN`: Cloudflare dashboard → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**, add **Account → D1 → Edit**, remove the zone row, limit to this account.

Set them with `gh secret set CLOUDFLARE_API_TOKEN --env production` (and the same for the account ID).
