---
name: "Lien desk: a started paper stays on the desk, whatever its day"
number: 354
group: close
status: written 2026-11-14 from a Lien desk session · the owner chose this shape, then parked it for its own session · built 2026-11-14 as v2.7261, one PR (#8116), on main
summary: >
  The Lien desk lists what is due within 30 days, and builds every list from the readers' rows
  alone. A paper someone already drafted, sent for approval, approved or held drops off every list
  while its day is further out. Three affidavits drafted on 2026-11-14 for a Dec 15 day showed in
  their jobs' Lien windows and nowhere on the desk. The fix keeps any started paper on the desk
  without widening the window for every job.
next: Retire the card once the office has seen a started paper on the desk.
size: S
ver: v2.7247 · v2.7261
blocker: none
---

# Lien desk: a started paper stays on the desk, whatever its day (#354)

## Where this comes from

On 2026-11-14 the dev seat saved affidavit drafts on three jobs at one property (v2.7247,
`apply_affidavit_draft`). Their day to file was Dec 15, 31 days out. Each showed in its job's Lien
window. None showed under Affidavits or on To do, because the desk looks 30 days ahead. The owner
asked whether to widen the window, chose the narrower fix below, and parked it here.

Which jobs these are is in the session notes, not here, because the repo is public.

## Today

- `src/hooks/useLienDeskData.ts` calls the three readers with `p_within_days: LIEN_DESK_LEAD_DAYS`
  (30, `src/lib/jobs/lienDesk.ts`): `list_lien_notice_months`, `list_lien_affidavit_windows` and
  `list_lien_retainage_windows`. Each reader drops a row whose day is past that window
  (`d.deadline <= app_today() + p_within_days`).
- `buildLienAffidavitQueue` (`lienDeskAffidavits.ts`) and `buildLienRetainageQueue`
  (`lienDeskRetainage.ts`) build their entries from the rows alone. A live desk item whose job has no
  row is on no list.
- `buildLienDeskQueue` (`lienDesk.ts`) already adds a job with a live notice item, but without that
  item's month rows, so the entry has no day.

## The change

1. **Ask further, keep less.** The hook asks the three readers for 180 days
   (`LIEN_DESK_STARTED_READ_DAYS`), then keeps a row when its day is inside the 30-day lead, or when
   its job holds a started desk item of the same kind.
2. **"Started"** is a desk item that is not voided, not sent and not missed: the rule `itemIsLive`
   already uses in `lienDesk.ts`.
3. **Notices keep only the months the started item names.** A draft for September must not bring
   October's window onto To draft with it.
4. **A pure kernel**, for example `src/lib/jobs/lienDeskStarted.ts`:
   `lienDeskKeepRows(rows, items, kind, todayYmd)` for affidavits and retainage, and
   `lienDeskKeepNoticeRows(rows, items, todayYmd)` for notice months. Tests beside it: a row inside the
   lead stays, one outside goes, one outside on a job with a drafted, held or approved item stays,
   one on a job whose item was sent, missed or voided goes, and a far notice month stays only when
   the live notice names it.

A started paper further out lands in **Coming up** on To do by its day, as any row more than seven
days out does (`groupOf` in `lienNextUp.ts`). An approval waiting on the leader still goes to his
group.

## Words to amend in the same PR

- `src/content/help/send-lien-notices-from-the-lien-desk.md`, *The piles*: "lists each job with a GC
  and an unpaid month whose window closes within 30 days" gains "and any paper already started,
  whatever its day".
- The GC picker's line in `LienDesk.tsx`, "Notices due in the next 30 days", stays true: the picker
  reads the queue's entries, and a started notice was already one of them.

## Rejected

**Widen the window to 60 days for every job.** Simpler, but every paper due in the next two months
would show, so the To do count and the lists would roughly double. The same 30-day constant also
drives the lien calendar's draft band (`lienCalendarBuckets.ts`), the supplier dates
(`lienJobSuppliers.ts`) and the timeline book (`lienTimelineBook.ts`). Those would have to be split
from it, or they would change too.

## Not touched

- No database function changes: the readers already take any `p_within_days`.
- The Dashboard's light read uses the same hook, so its counts gain the started papers too. That is
  the point: a started paper is work in hand.

## How to verify

- The kernel's tests, then the desk's render smokes.
- Walk with a ZZ test job before a live one: set its last day of work so the affidavit's day is about
  40 days out, draft the affidavit from its Lien window, and open the desk. Before the change it is on
  no list. After it, it reads under Affidavits in To draft and under Coming up on To do.
- The three live drafts from 2026-11-14 enter the 30-day window on their own from Nov 15, so they
  cannot show the change after that day.

## Where it stands

Built 2026-11-14 as v2.7261: the kernel `src/lib/jobs/lienDeskStarted.ts` with its tests, the three
reader calls in `useLienDeskData` asking 180 days ahead and keeping a row inside the lead or on a job
with a started paper of that kind, and the guide's two sentences. The owner picked this shape over
widening the window, then asked for it on a card instead of in the session that found it.
