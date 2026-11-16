---
description: "import for the arts programming desk"
---

# import

Run `npm run arts -- import artifax examples/sessions.csv --kind=sessions --mapping=examples/sessions-mapping.json --dry-run --actor="Actual operator"`. Replace examples with the operator's supplied values. Add --json when the full record is needed.

Read the relevant production and current records first. Validate the requested change, use a named actor, and report the returned record. Never invent permissions or evidence.

Read docs/replace-artifax.md first. Inspect the actual export and map its headings. Reconcile the dry run before running without --dry-run. Retain the original file.
