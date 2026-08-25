# 20260825230000 — estimate photo handover (v2.2298)

Groundwork for the Quickfill "Field photos → Drive" handover (long-term all customer photos live in Google Drive; Quick Estimate photos land in Supabase Storage first because the master can't do Drive from the field):

- **`estimate_photo_handover`** (new table) — one row per estimate: `drive_link` (the Google Drive folder that replaced the photos), `moved_by`, `moved_at`. Lives in its own table rather than a column on `estimates` because estimates are only office-editable while `status='draft'` — the handover usually happens after the CO is sent. Select mirrors `estimate_field_photos_select`; insert/update by office roles (dev, assistant, controller, estimator, master_technician, primary) with `moved_by = auth.uid()`. Ends with both read-only training blocks.
- **`estimate_field_photos_delete` recreated** — widened from creator-or-dev to also allow the office roles above, since the handover deletes the moved photos' metadata rows.
- Out-of-band (already applied 2026-08-25 with the bucket setup): `estimate_field_photos_delete` policy on `storage.objects` so the office can remove the moved bytes from the bucket.
