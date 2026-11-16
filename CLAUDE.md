# Arts Programming for Claude Code

For the programmer or production coordinator running a performing-arts season. Read the current records before advising. The database is the source of truth. This is an internal desk, not a ticketing, rights-licensing or safety-certification service.

## Routing

| Request | Recipe |
|---|---|
| seasons | .claude/commands/seasons.md |
| productions | .claude/commands/productions.md |
| works | .claude/commands/works.md |
| spaces | .claude/commands/spaces.md |
| season-review | .claude/commands/season-review.md |
| repertoire | .claude/commands/repertoire.md |
| rehearsal-call | .claude/commands/rehearsal-call.md |
| clashes | .claude/commands/clashes.md |
| rights-due | .claude/commands/rights-due.md |
| actions-due | .claude/commands/actions-due.md |
| credit-gaps | .claude/commands/credit-gaps.md |
| work-history | .claude/commands/work-history.md |
| owner-workload | .claude/commands/owner-workload.md |
| safety-gaps | .claude/commands/safety-gaps.md |
| capacity-check | .claude/commands/capacity-check.md |
| programme-length | .claude/commands/programme-length.md |
| compliance | .claude/commands/compliance.md |
| attention | .claude/commands/attention.md |
| notes | .claude/commands/notes.md |
| audit | .claude/commands/audit.md |
| imports | .claude/commands/imports.md |
| add-season | .claude/commands/add-season.md |
| add-production | .claude/commands/add-production.md |
| revise-production | .claude/commands/revise-production.md |
| add-work | .claude/commands/add-work.md |
| add-space | .claude/commands/add-space.md |
| add-programme | .claude/commands/add-programme.md |
| revise-programme | .claude/commands/revise-programme.md |
| add-session | .claude/commands/add-session.md |
| revise-session | .claude/commands/revise-session.md |
| clear-rights | .claude/commands/clear-rights.md |
| review-safety | .claude/commands/review-safety.md |
| add-action | .claude/commands/add-action.md |
| complete-action | .claude/commands/complete-action.md |
| set-review-date | .claude/commands/set-review-date.md |
| log | .claude/commands/log.md |
| import | .claude/commands/import.md |
| export | .claude/commands/export.md |
| weekly-review | .claude/commands/weekly-review.md |
| draft-programme | .claude/commands/draft-programme.md |
| draft-call | .claude/commands/draft-call.md |
| production | .claude/commands/production.md |
| help | .claude/commands/help.md |
| Change a field or rule | .claude/commands/customise.md |
| New report | .claude/commands/new-view.md |

## Rules

- Use one CLI: npm run arts -- help. Read docs/cli.md for fields.
- No email, publishing, payments or external system writes. Drafts remain in drafts/.
- Use the operator's actual name for every mutation. Names label changes, they do not authenticate people.
- Exact codes, unique code or ID prefixes and case-insensitive names resolve records. Ambiguity lists choices and exits 1.
- Rights evidence is scoped to the current programme revision, territory, context and dates. Only a human can establish whether permission covers every use and owner.
- Changing a session invalidates its prior safety review. A clean report is only a record check.
- Keep originals, append corrections, preserve audit history. Never delete history.
- Production timezone is required. Call output uses UTC. Supply explicit offsets on input and check daylight-saving transitions with the venue.
- Read full production history before drafting a programme or call sheet. Never invent credits, permissions or facts.
- Never seed a working database. npm test creates a disposable database. Shared database seed requires --demo-database.
- Migrations work with Postgres 16+ and PGlite. New fields use new migration files.

## Files

scripts/arts.mjs: one CLI. supabase/migrations/: schema. supabase/seed.sql: fictional demo. views.json and documents.json: read-only reports. brand.json: name, logo and colours. docs/replace-artifax.md: import and reconciliation. docs/compliance.md: rules and sources.

Omni by Enterprise DNA installs and runs the customised version. https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=artifax
