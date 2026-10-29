# 20261029010000_materials_on_site.sql (2026-10-29, Materials on site, punch list #209)

The ground under *Materials on site* (`to-dos/materials-on-site/`): what is in the cages and boxes a crew leaves on a big job site, kept as a ledger of movements rather than a stock table.

- **`job_places`** — the places on a site a container can stand in (one per job and name).
- **`job_containers`** — a cage, box or loose pile, or the job's *Unsorted* row a delivery lands in. `code` is a generated column, the id's first eight hex characters in capitals, unique: the short address the printed label's QR carries (`prts.co/b/<code>`, read by the app's `/b/:code`). A live label is unique per job (`retired_at IS NULL`).
- **`job_container_moves`** — a box moved from one place to another, by whom and when.
- **`job_material_movements`** — the append-only ledger: one row per press on the phone or line landed by the office, with the eight reasons (`delivered`, `moved`, `used`, `returned`, `taken`, `cannot_find`, `damaged`, `counted`). On hand is the sum of a container's rows; a `counted` row is the number counted, not a change, and resets the line; a wrong press gets a new row, never an edit. `part_id` is null for a name typed on site; `source` names the invoice or PO behind a delivery; `item_id` waits for V3's engraved parts.
- **`job_box_photos`** — a photo of a box: the phone shrinks the shot and puts it in the bucket; the photo sweep files it in the job's Drive folder under `file_name`, writes `drive_file_id` and `filed_at`, and deletes the bucket copy. `status` reads sending, on-phone, filed or shared.
- **The gate** `on_site_can_touch_job(job_id)`, SECURITY INVOKER on purpose: true when the caller can see the job in `jobs_ledger` under their own RLS (so a primary keeps their job scope) or is on the job's team (`jobs_ledger_team_members`, how helpers and subcontractors reach a job). Every policy reads it. Movements and moves are select + insert only; containers and places allow update (move, pin, retire); a photo row may be updated by the one who took it.
- **The bucket** `box-photos`: private, 2 MB a file, image types only; objects are `<job_id>/<photo_id>.jpg`, so the same gate reads the job from the path.
- The three house calls at the end: training-mode write and statement blocks, and the digital-twin fence (no `bid_id`, so a twin writes nothing here).

Apply order: the client first is harmless — the Materials tab and the On site tab read empty and say so until the push, and a write fails with the error's words. Push after the ground PR merges, then regenerate `src/types/database.ts`. The sweep's second source (`photo-save`) ships in its own PR and deploys after this is applied.
