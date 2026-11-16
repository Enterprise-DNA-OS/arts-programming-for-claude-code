# CLI reference

Node 22.13 or newer. Run npm run arts -- help. All reads support --json; dates stay calendar dates and call times are emitted in UTC. No silent timezone assumption is used on input.

## Reads

- `seasons`
- `productions`
- `works`
- `spaces`
- `season-review`
- `repertoire`
- `rehearsal-call`
- `clashes`
- `rights-due`
- `actions-due`
- `credit-gaps`
- `work-history`
- `owner-workload`
- `safety-gaps`
- `capacity-check`
- `programme-length`
- `compliance`
- `attention`
- `notes`
- `audit`
- `imports`

Production detail: `npm run arts -- production TIDE --json`. It includes programme, calls and notes. Empty matches fail; ambiguous references list candidates and exit 1.

## Writes and files

```bash
npm run arts -- add-season --code=CODE --name="Season" --starts=2027-01-01 --ends=2027-12-31 --actor="Your name"
```

```bash
npm run arts -- add-production --code=CODE --name="Production" --season=CODE --owner="Name" --territory=NZ --timezone=Pacific/Auckland --context=dramatic --review-due=2027-01-01 --actor="Your name"
```

```bash
npm run arts -- add-work --code=CODE --name="Work" --creator="Name" --seconds=240 --actor="Your name"
```

```bash
npm run arts -- add-space --code=CODE --name="Space" --capacity=80 --turnaround=30 --actor="Your name"
```

```bash
npm run arts -- add-programme --code=CODE --production=CODE --work=CODE --position=1 --credit="Approved wording" --actor="Your name"
```

```bash
npm run arts -- revise-programme --item=CODE --credit="Corrected wording" --actor="Your name"
```

```bash
npm run arts -- add-session --code=CODE --production=CODE --space=CODE --kind=rehearsal --starts=2027-01-01T10:00:00+13:00 --ends=2027-01-01T12:00:00+13:00 --people=20 --status=tentative --actor="Your name"
```

```bash
npm run arts -- revise-session --session=CODE --people=25 --actor="Your name"
```

```bash
npm run arts -- clear-rights --item=CODE --decision=approved --from=2027-01-01 --to=2027-12-31 --authority="Rights holder" --evidence="Evidence reference" --actor="Your name"
```

```bash
npm run arts -- review-safety --session=CODE --evidence="Risk controls reviewed" --consulted="Stage crew and venue" --actor="Your name"
```

```bash
npm run arts -- add-action --code=CODE --production=CODE --description="Follow up" --owner="Name" --due=2027-01-01 --actor="Your name"
```

```bash
npm run arts -- complete-action --action=CODE --evidence="Completion reference" --actor="Your name"
```

```bash
npm run arts -- set-review-date --production=CODE --due=2027-01-01 --actor="Your name"
```

```bash
npm run arts -- log --production=CODE --body="Factual note" --actor="Your name"
```

```bash
npm run arts -- import artifax examples/sessions.csv --kind=sessions --mapping=examples/sessions-mapping.json --dry-run --actor="Your name"
```

```bash
npm run arts -- export --out=exports/new-archive
```

```bash
npm run arts -- production TIDE
```

```bash
npm run arts -- draft-programme --production=TIDE
```

```bash
npm run arts -- draft-call --production=TIDE
```

Every mutation is one transaction. Rights decisions: pending, approved, exempt, revoked. The newest decision supersedes earlier decisions. Exempt needs evidence and authority just like approved. Rehearsal kinds: rehearsal, performance, get-in, get-out. Status: tentative, confirmed, cancelled. Cancelled calls are excluded from clashes and rights checks. Programme revisions may also change --work. Session revisions may change --starts, --ends, --space, --people or --status. Dates must be real YYYY-MM-DD values.

Import kinds: seasons, spaces, works, productions, programme, sessions. Map CLI option names to exact CSV headings in a JSON file. The order respects dependencies. Historical clearances are not imported as approved rights. Actor names are labels, not authentication.

The archive includes twelve collections and a count manifest, including originals and audit. Export refuses an existing destination. It is a portable archive, not a database restoration command. Use database backups for recovery.

Production changes: `npm run arts -- revise-production --production=TIDE --owner="Name" --context=dramatic --status=confirmed --actor="Name"`. Supply only changed fields. Context: unknown, dramatic, other. Status: planned, confirmed, closed. A status label never certifies a performance.
