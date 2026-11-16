# Arts Programming for Claude Code

Own the programme office: seasons, repertoire, rehearsal calls, credits, rights evidence and production follow-up. MIT-licensed software from Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free source code. Install, map your exports and run it. | Your season rules, credits, paperwork and Artifax records mapped across. [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=artifax). | Installed and operated through Omni by Enterprise DNA. One setup fee, then a retainer. [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=artifax). |

## What this replaces

The weekly programming desk around an arts season: repertoire decisions, rehearsal and performance calls, clashes, rights follow-up, credits and working papers. Artifax's [current pricing page](https://artifax.com/pricing/) asks for a tailored quote. Its supplier-authored [May 2024 procurement schedule](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-14/documents/93351/510593779877176-pricing-document-2024-05-07-0958.pdf) lists Tier 6 at GBP 22,760 a year excluding VAT. That is a historical benchmark, not a current quote or a verified customer invoice.

The base has no ticket sales, payments, email sending, licence issuance, public calendar or multi-user sign-in service. It is independent of Artifax and is not a feature-for-feature reproduction. Review [the switching guide](docs/replace-artifax.md) for what carries across.

## Quick start

Node 22.13 or later. No server or account is required for the embedded demo.

```bash
git clone https://github.com/Enterprise-DNA-OS/arts-programming-for-claude-code.git
cd arts-programming-for-claude-code
npm install
npm test
npm run demo
npm run arts -- season-review
npm run arts -- clashes
npm run arts -- rights-due
npm run view
npm run docs
```

All demo records are fictional. The demo deliberately includes overlapping calls, short turnaround, missing credits, expired rights, overdue actions and missing safety reviews. Seed is idempotent. Never seed a working database. Shared seed requires --demo-database explicitly.

Without DATABASE_URL, PGlite stores data under .data/db (or DATA_DIR). With DATABASE_URL, the same migrations run on Postgres 16 or newer. A trusted database operator owns access. Row security is enabled and public access revoked; set up controlled roles and backups before shared use. Named actors are audit labels, not authenticated identities.

## Five weekly rituals

- /season-review brings programming decisions, rights gaps and open actions together.
- /rehearsal-call lists every active call with explicit UTC timestamps.
- /clashes finds space overlaps and insufficient turnaround.
- /rights-due joins performances to the latest evidence for each programme work.
- /weekly-review writes the season review, rights follow-up, clashes and actions into a branded draft.

The single CLI is npm run arts -- help. [Full syntax](docs/cli.md). There are 45 slash-command recipes in .claude/commands, including /customise and /new-view. All 43 CLI commands support --json. Partial IDs and case-insensitive names work; ambiguity lists candidates and exits 1. No mutation sends anything.

## Ten questions to ask

These joins and local rules work today. They are not a claim that Artifax cannot build a similar report.

1. Which productions combine rights gaps and outstanding actions? season-review
2. Which rehearsal conflicts with another production's call? clashes
3. Which calls leave too little time for a changeover? clashes
4. Which performance falls outside the dates in its rights evidence? rights-due
5. Which programme credit is still blank? credit-gaps
6. Which calls changed after the last safety review? safety-gaps
7. Who owns the largest overdue action list? owner-workload
8. How many seconds of repertoire are programmed for each production? programme-length
9. Which works recur across productions? work-history
10. Who changed a call, and what did it say before? audit

## Your first hour: ten things to ask for

1. Put our business name and colours in brand.json.
2. Run the fictional season review.
3. Show every rehearsal clash.
4. Explain the expired rights evidence.
5. Create our season and spaces.
6. Set each production's actual timezone.
7. Inspect and map one real Artifax export.
8. Dry-run it and reconcile the source counts.
9. Draft the programme and production brief.
10. Set up controlled access, backups and a tested restore.

## Documents, views and custom changes

Change brand.json once. npm run view writes two read-only dashboards. npm run docs writes three kinds of working paper per production: production brief, programme credits and safety handover. /draft-programme and /draft-call write to drafts. Dates are explicit and call times are UTC. All report text is escaped. Read [why no front end](docs/why-no-front-end.md).

/customise writes a new migration and updates commands and reports. /new-view adds a read-only question to views.json. The agent handles the work; no second runtime-specific implementation is needed.

## Import, evidence and ownership

The mapped Artifax report imports in one command, with a dry-run option. [Import guide](docs/replace-artifax.md). Originals, all source columns, mapping and fingerprint stay in the database. Bad rows roll back the whole file. Identical files skip. Changed existing records require a reviewed revision. Imported labels never become approved rights evidence.

Clearance decisions and safety reviews are append-only through the application. The newest clearance supersedes the earlier decision; a revised programme invalidates its previous evidence. Session changes invalidate their safety review. Changes retain old and new values with the named operator. A database owner can alter database controls, so this is not tamper-proof.

[Compliance rules and sources](docs/compliance.md). Clean checks mean the recorded fields pass the local rules. They do not license a performance, certify safety or replace professional review. The explicit production timezone controls calendar-date checks. Each imported timestamp needs an offset, including across daylight-saving changes.

Export writes twelve collections and a count manifest to a new private folder, including original imports and audit history. It is a portable archive, not a restoration command. Back up and restore the full database separately. Keep exports, originals and credentials out of Git.

## Validation

npm test creates a temporary database, clears inherited DATABASE_URL unless ARTS_TEST_POSTGRES_URL deliberately names a disposable test store, migrates twice, seeds twice and exercises every command. Checks cover rights revocation and revision, date boundaries, invalid input, import dry runs and rollback, original bytes, overlaps, stale reviews, ambiguous matches, HTML escaping, exported counts and generated documents. The manual CI workflow runs on Windows and Linux and also checks PostgreSQL.

## Installed for you

Enterprise DNA maps your Artifax exports, adapts the programme office to your rules and runs it through Omni by Enterprise DNA. One setup fee, then a retainer. [Book Sam's 30-minute call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=artifax).

MIT. Copyright 2026 Enterprise DNA.
