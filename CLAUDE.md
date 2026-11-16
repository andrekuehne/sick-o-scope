# sick-o-scope

## UI language

The UI is German (`src/client/strings.ts`). Write what a German family would naturally say, never a literal translation of a `GLOSSARY.md` term: a Bug is an "Infekt" (the most Bugs: "Virensammler"), never a "Käfer". English loanwords Germans use anyway are fine ("Mystery-Bug").

## Agent skills

### Issue tracker

Issues live in GitHub Issues for andrekuehne/sick-o-scope (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
