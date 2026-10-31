---
name: "The Job Mode clocking guide still describes the clock before the offline queue"
number: 225
group: ready
status: found 2026-10-31 in v2.6198's work on #163's live-test defects · not started
summary: >
  The guide *clock in and out with Job Mode* still says a punch with no signal shows *No connection
  … nothing was saved* with Retry, that nothing was recorded, and that you tap Retry once you have a
  bar. Since #163's queue (v2.6099), Clock In and Clock Out with no signal are kept on the phone with
  the moment they were pressed and sent on their own when the signal returns. A crew member reading
  the guide is told the opposite of what the app does.
next: Rewrite the guide's *When you have no signal* section, its basement example and the clock-out sentence to match, linking *keep working when the signal drops*.
size: XS
blocker: None.
ver: v2.6099 · 6101 · 6198
opinion: build — a guide fix; the words a crew reads are wrong today
mockup: not required — words in a guide
---

# The Job Mode clocking guide still describes the clock before the offline queue

## What is stale

These passages of `src/content/help/job-mode-clocking.md` are stale.

- **When you have no signal.** It says the sheet shows ***No connection — the app couldn't reach the server, so nothing was saved*** with a Retry button. It says nothing was recorded, and to tap Retry as soon as you have a bar. Then it says the line turns to ***Back online — tap Retry to try again***, and the punch waits for your tap.
- **The example *Clocking in from a basement*.** It walks through the same Retry.
- **After the clock-out steps.** It says: "If it fails to reach the server, the same Retry panel as Clock In appears. Nothing is recorded until it succeeds."

Since v2.6099 the app does something else. The guide *keep working when the signal drops* (v2.6101) has the full story.

- With no signal, Clock In and Clock Out close their window as usual. A small message reads *Kept on the phone. It goes out when the signal is back.*
- The clock shows you clocked in, or out, from the moment you pressed. Since v2.6198 it does so even when you come back to the Dashboard before the signal does.
- The line at the top of every screen shows the press waiting. The phone sends it on its own when the signal returns, and the line turns green.
- A punch that reaches the office late is filed like typed hours.
- Nothing is sent twice, since every press carries its own id.

## The plan

One PR:

1. Rewrite the section, the example and the clock-out sentence to say what the app does. Link `/help/keep-working-when-the-signal-drops` rather than repeat it.
2. Keep the paragraph on screens that only show things accurate: they show Retry and reload by themselves when the signal returns. If #224 lands first, use its read sentence there.
3. Follow the plain-words rules in `src/lib/plainWords.ts`. The guide tests must pass: `helpGuidePlainWords`, `helpGuideContent` and `helpGuideLinks.guides`.
4. Add a release note and a `docs/recent-features/` fragment. Then delete this card.

## How to verify

Run `npx vitest run src/lib/helpGuidePlainWords.test.ts src/lib/helpGuideContent.test.ts src/lib/helpGuideLinks.guides.test.ts src/lib/releaseNotes.test.ts --maxWorkers=2 --minWorkers=1`. Then read the guide at `/help?g=job-mode-clocking` on the dev server.
