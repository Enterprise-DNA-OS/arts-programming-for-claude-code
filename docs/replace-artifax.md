# Bring your Artifax programme history

Checked 16 November 2026. Artifax documents CSV and spreadsheet report exports on its [reporting page](https://artifax.com/features/reporting/). Its [supplier service listing](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/510593779877176) also describes CSV, XML and calendar extracts. Reports vary by installation. No universal column layout is claimed. The included CSV files are synthetic, not vendor-generated exports.

1. Export the required Artifax reports with stable IDs, full date ranges and timezone information. Keep unfiltered originals. Obtain seasons, spaces, works, productions, programme entries and calls as separate reports where available.
2. Inspect headings and values. Create a mapping JSON for each report, like examples/sessions-mapping.json. Map IDs to code, never row numbers or mutable display names. Map linked IDs consistently. Convert event types explicitly to rehearsal, performance, get-in or get-out and statuses to tentative, confirmed or cancelled. Add explicit UTC offsets to date-time values. Do this on a retained working copy, keeping the original export separately.
3. Create missing reference records deliberately. Import in order: seasons, spaces, works, productions, programme, sessions. Each mapped report imports in one command:

`npm run arts -- import artifax imports/calls.csv --kind=sessions --mapping=imports/calls-mapping.json --actor="Your name" --dry-run`

4. Reconcile row counts, reference IDs, rehearsal times, cancelled calls and work durations with Artifax. Remove --dry-run to commit the same validated file. Any malformed row rolls back the whole file, including audit changes. Original imported bytes, mapping, all source fields and a fingerprint remain in the database.
5. The identical file and mapping are a safe no-op. Overlapping non-programme exports accept unchanged rows, but changed rows stop for review. Overlapping programme exports stop when a code exists; reuse the complete original file or import into a separate production. Use revision commands for reviewed changes. Do not rewrite history silently.
6. Run season-review, rights-due, clashes, compliance and export. Check every performance against actual permissions. Import retains source fields but never treats an exported label as a current signed clearance. Record evidence using clear-rights and review-safety.

One-day switch applies to mapped record import and reconciliation, not a promise to replace every integration in a day. Contracts, attachments, ticketing, accounting, box-office sales, private annotations, user access, automatic notifications and historical rights decisions need separate work. No files are downloaded from external evidence references. Original vendor account permissions do not carry across.

Keep the original system until counts, timezones, draft paperwork, access controls, backups and restored data have been checked. Enterprise DNA maps the actual exports and builds the extra connections for your version.
