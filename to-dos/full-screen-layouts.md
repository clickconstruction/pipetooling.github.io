---
name: "Full screen that buys a layout: the Lien desk, Put a GC on notice, Accounts Receivable"
number: 57
group: gated
status: not started · the button shipped v2.4065 (same window, more room); the redrawn layouts are this card
summary: >
  The full-screen button is on all four big dialogs. Only the Contract sweep got a layout that uses
  the room — the list, the agreement and its paper side by side (v2.4049). The Lien desk, Put a GC on
  notice and Accounts Receivable fill the screen with the same columns they have in a window. Each has
  a paper or a second list that could sit beside the work instead of opening over it.
next: >
  Pick which of the three (if any) earns a redrawn full screen, then a before/after mock-up for that one
  from the live captures, then build it the way v2.4049 did the sweep.
size: M per dialog — a layout branch on `fullScreen` in the dialog, no data change
blocker: Your call on which dialogs, and a mock-up for each before it is built.
ver: after v2.4065
---

# Full screen that buys a layout: the Lien desk, Put a GC on notice, Accounts Receivable

## The ask

The owner, 2026-09-28, on the Contract sweep: *a button towards the top that the user can toggle to
make it jump between full screen and be a modal.* The critique that shaped the sweep's build: stretching
a window buys nothing — full screen is worth a button when it buys a layout the window cannot hold.
The sweep got that (v2.4049: list · agreement · paper, each the height of the screen). The owner then
asked for the same button on the Lien desk, Put a GC on notice and Accounts Receivable, which shipped
in v2.4065 as **the same window with more room**. The fragment called a redrawn layout *a separate ask*;
this card is it.

## What each could put side by side (proposals, not decided)

- **Lien desk** — today a 320 px job list and the notice pane (gates, owner of record, hours). Full
  screen could add the notice **as it prints** (`buildLienNoticePreviewHtml`, `src/lib/jobs/lienNoticePreview.ts`)
  as a third column, so the gates and the paper they gate are read together instead of through the
  preview window.
- **Put a GC on notice** — today the step bar over the jobs-by-stage table; a notice opens over the
  window (`GcNoticePreviewModal`). Full screen could keep the table on the left and the selected job's
  notice on the right, and ‹ › walk the run in place.
- **Accounts Receivable** — today deposits | the match pane. Full screen could add the payer's open
  bills (the Customers rollup, v2.2571) as a third column, so a match is made with the whole account
  in view.

## Where it plugs in

- `src/components/ModalFullScreenToggle.tsx` — `useModalFullScreen(key)` already hands each dialog
  `fullScreen`; keys `lien-desk`, `gc-on-notice`, `accounts-receivable`.
- `src/components/jobs/LienDeskModal.tsx`, `GcOnNoticeModal.tsx`, `BankPaymentsModal.tsx` — each draws
  its own frame (not `ResponsiveModalShell`); the layout branch goes in the body grid.
- The sweep's pattern to copy: `JobsContractSweepModal.tsx` (`sweep-grid`, `paper(fullScreen)`), and the
  lesson that the toggle must never remount the body (a typed field survives it).

## The mock-up

The live captures of all three, in a window with the button and full screen, are on the canvas
*Contract sweep full-screen toggle* — https://claude.ai/artifact/9Cp63b55vq9db8Yka2UsnA (rows 3–5).
They show today's full screen, not a redrawn one; a redrawn layout still needs its own before/after.

## How to verify

Worktree dev server on a free port with `.env.local` copied in, `/dev-login?as=&to=%2Fjobs`, 1440 × 900;
the Lien desk and Accounts Receivable open from the Pipeline's section tools, Put a GC on notice from
the desk's *Put a GC on notice…* menu (reads only — never press a send). Measure the panel and the
columns with the page's own layout, and press the toggle both ways with a field typed first.
