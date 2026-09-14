# 20260914190000_lien_desk_affidavits.sql (2026-09-14, v2.3412)

The Lien desk's affidavit kind (PR 3 of the train in `to-dos/lien-desk/`). Additive; no table changes.

- **`lien_filing_deadline(month, property_kind)`** — the § 53.052 date in SQL: the 15th of the 4th month after the last month worked (3rd residential), weekends rolled — the twin of `filingDeadlineForMonth` in `src/lib/jobs/lienDeadlines.ts`.
- **`list_lien_affidavit_windows(p_within_days = 30)`** — every unpaid billed job with approved clock sessions whose affidavit window is within the lead time (a week behind so a missed window is seen): the last month worked, the deadline, whether the job has a GC (sub), whether a live § 53.056 notice is recorded, whether an affidavit is already filed (`filed_at`), the gate facts (owner of record with a mailing address, county + legal description, homestead), and the live desk item of kind `affidavit`. Office-gated (dev · assistant-like · master); empty otherwise. Compares against `public.app_today()`.

- **`list_lien_notice_months()` replaced** (the first live pass): a job counts when its status is billed **or** it has a billed invoice (a Working job with an unpaid bill was left out), and once any month is inside the window every unnoticed month with an open window comes back, so one notice names June, July and August.

Apply order: additive; the desk's Affidavits kind fails quiet (empty) until applied. Push with (or after) `20260914180000_lien_desk.sql`.
