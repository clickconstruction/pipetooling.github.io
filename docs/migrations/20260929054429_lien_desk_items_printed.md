# 20260929054429_lien_desk_items_printed.sql (2026-09-29, v2.4119)

Two nullable columns on `job_lien_desk_items`: `printed_at timestamptz` and `printed_by uuid → users`. The Lien desk's run stamps them when *Print the packet* runs; an approved item with a `printed_at` reads as the desk's new pile, **In the mail · tracking owed**, until *Record the mailing* writes its notice to `job_lien_filings` and marks the item sent. Additive: no constraint change, no policy change (the office's existing update policy covers the new columns), no backfill — every item printed before this migration stays in *Ready to send* until it is recorded, as it did.

Apply order: either side first. The client stamps `printed_at` best-effort (a failure only means the item stays in *Ready to send*), so a client deployed before the push degrades to today's behaviour; a push before the deploy changes nothing the old client reads (`select('*')`).

Shipped with v2.4119 (the run's mailing workflow: the printed pile, *Record the mailing*, tracking-number shape checks, envelope faces, *add the number* on a sent notice, the Dashboard's tracking-owed line).
