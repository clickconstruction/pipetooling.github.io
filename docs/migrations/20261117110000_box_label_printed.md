# 20261117110000_box_label_printed.sql (2026-11-16, v2.7518)

A box remembers when its label last went out. Punch list #304, and the owner's word of 2026-11-16 on the third call of the Print labels mock-up ([`to-dos/materials-one-story/print-labels-which-job.html`](../../to-dos/materials-one-story/print-labels-which-job.html)): *add a true "not printed yet" mark*. This is the database half. No screen reads or writes the column yet.

Until now the app kept no record of which labels were printed. The *Which job?* window of **Print labels** (v2.7482) could only say which boxes were added in the last seven days, which guesses at the same question: a box added eight days ago with no label read as done, and one added yesterday and labelled within the hour read as waiting.

## The column, on `job_containers`

| Column | Type | What it holds |
|---|---|---|
| `label_printed_at` | `timestamptz`, nullable, no default | NULL: the app has not seen this box's label go out. A time: when it last did, by the P-touch, by the print window, or by a person saying the box already wears one. A person taking the mark off sets it back to NULL. |

## How it is written

By the screens, the way every other change to a box is written: an `UPDATE` of the row under the table's own policy, `job_containers_update`, which asks `on_site_can_touch_job(job_id)`. No function and no grant. The read-only blocks, the twin fence and the archived seal already stand on `job_containers`, so a training account leaves no mark.

## Boxes made before the column

A box made before this column reads NULL whether or not it wears a label, and nothing can tell the two apart. The client that follows counts a NULL as *not printed yet* only for a box made after the mark began, and says nothing about the older ones until their label prints or a person marks them.

## Order

Additive and idempotent: a nullable column with no default is a catalog change alone, and no row is rewritten. No `CREATE TABLE`, so no fence calls. The push can come any time after the merge. **The client that follows must not merge before the push**: it names the column in the read of every box, and PostgREST refuses a select that names a column it does not have.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
