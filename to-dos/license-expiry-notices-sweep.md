---
name: Sweep the licenses for the expiry notices a save never sent
number: 253
group: ready
status: claude/253-license-expiry-sweep-e892e1 · the owner's three calls made 2026-11-07 (server, the portal's sender, no notice for a lapsed license) · sweep PR open
summary: >
  The dispatch notice for a license about to expire is asked for only when someone saves the
  license on People → Licenses. The licenses imported in March were never saved there, so no
  notice was ever asked for, and by November 14 of the 24 on file had lapsed with nothing sent.
  A sweep that asks for every license inside the window, on a schedule, catches what a save
  never sees.
next: The owner picks the sweep's home, then one PR builds it with its fragment and a ZZ Test walk.
size: S
blocker: Whose name a notice goes out under when nobody saved the row, and whether a license already past its expiry gets a notice at all or only its place in the Expired section.
ver: v2.6424
opinion: build — the function and its once-only stamp exist; the sweep is a loop and a schedule
mockup: not required — a scheduled sweep, no screen
---

# Sweep the licenses for the expiry notices a save never sent (#253)

## The ask

The People → Paperwork design spike of 2026-11-02 found the Licenses tab saying *Nothing expires in
the next 30 days* while most of the licenses on file had already lapsed. v2.6424 gives the tab an
**Expired** section so the lapsed ones are seen. This card is the other half: the notice that
should have gone to Dispatch before each one lapsed, and never did.

## What exists

- `notify_dispatch_license_expiry_if_needed(p_license_id, p_link)` (the baseline, `SECURITY DEFINER`):
  for a license whose expiry is today through today + 30 and whose `expiry_dispatch_notified_at` is
  still null, it inserts one `dispatch_requests` row (*License expiring: … expires … · Open [1]*,
  `from_user_id = auth.uid()`, status open) and stamps the license, so a license is asked about
  once. It answers null, and does nothing, when the caller is not a dev, a pay-approved master, an
  assistant or an assistant of one, when there is no signed-in user, and when the expiry is already
  past or more than thirty days out.
- The tab calls it from one place: `maybeNotifyDispatchLicenseExpiry` in
  `src/components/people/PeopleLicensesTab.tsx`, after **Save** on the Add license or Edit license
  window, then `notify-dispatch-request` sends the push for the row it made.

## The gap

Nothing else calls it. A license that reaches its window without being saved again on the tab is
never asked about: the March import's rows, and any row that was added more than thirty days before
its expiry (the common case) and then left alone. The stamp on every one of the 24 is null.

## Two homes for the sweep, for the owner's call

1. **Server, on a schedule.** A new `SECURITY DEFINER` function walks `person_licenses` where the
   expiry is inside the window and the stamp is null, and makes the same `dispatch_requests` row
   and stamp per license. `auth.uid()` is null under `pg_cron`, so the function needs a name of its
   own for `from_user_id` (the office account the other cron notices use, or a nominated dev), and
   that is the first blocker. A daily `pg_cron` slot beside the other sweeps; one migration, with
   `docs/migrations/<version>_<slug>.md`. Catches everything, every day, whether or not anyone opens
   the tab.
2. **Client, on the tab's load.** `PeopleLicensesTab` calls the existing function for each license
   in the thirty-day strip whose stamp is null, as the save does today, under the viewer's own name.
   No migration, no function change, one PR. Misses a window nobody opens the tab in, and the notice
   reads as asked for by whoever opened the tab.

Either way a license already past its expiry gets no notice from the function as written (it
answers null below `CURRENT_DATE`); the Expired section is where those are seen. The second
blocker is whether the owner wants the sweep to widen the function to lapsed rows too.

## How to verify

Make a `ZZ Test` person on People → Users with a license expiring in ten days (the tab's **+ Add
license** stamps that one on save, so make it through the agent seat or with a date outside the
window and then edit the date without the tab's Save — a direct update through the dev MCP's plan →
apply door). Run the sweep. Expect one `dispatch_requests` row naming the license and a stamp on
the row. Delete the person, the license and the request before the session ends.
