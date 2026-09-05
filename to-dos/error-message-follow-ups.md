# Error messages: the offline retry path and the last text checks

Status: not started · source: fragment v2.2843 "Not in this PR"; journey-map Tier-1 #6 (b) and (c)

## The ask

v2.2843 stopped calling every database error "No connection". Two halves were split off on purpose.

## The items (validated 2026-09-05)

- **(b) Genuine offline path**: a Retry button plus an `online` listener where the connection really failed (J2-F3), so a crew member with no signal gets one honest retry instead of four silent ones.
- **(c) The week-grid `bid:` branch** (J18-F1's sender) — still renders the old copy.
- `src/components/ClockInOutButton.tsx:1811` still has its own `includes('fetch')` text check on an already-formatted message; narrower now that reads say "Couldn't load …", but it belongs in the (b) pass.

## Where it plugs in

- `src/utils/errorHandling.ts` (`classifyError` and the class → copy mapping), `formatErrorMessage` call sites, the week grid's bid branch, `ClockInOutButton`.
- `docs/TROUBLESHOOTING.md` section on what the two messages mean.

## How to verify

- DevTools offline: clock-in shows the offline copy with Retry; back online, Retry succeeds without a reload. A 42501 refusal never shows Retry.
