---
name: "Job Mode names the job's number when the number is a Click number"
number: 197
group: ready
status: proposed 2026-10-27 from the live press run of #189 · ready to build, no decision needed
summary: >
  The Job Mode card hands Leave report, Turnaway and % done the job's hcp_number, falling back to a
  dash. A job numbered in click_number has no hcp_number, so those windows show "—" where the number
  belongs, and a Turnaway reaches the Dispatch inbox as "Turnaway: — <job name> — Site not ready".
  The card's own header and New report's job search both carry the number. The live run of
  2026-10-27 found it on the ZZ test job. The fix gives the card's target the same number.
next: Build it, one small PR.
size: XS
blocker: none
opinion: build — a dispatcher placing a trip charge reads the number first
mockup: not required — the number in three existing titles
---

# Job Mode names the job's number when the number is a Click number (#197)

## Found

On 2026-10-27 the live press run of punch list #189 filed a Turnaway from the Job Mode card on the
ZZ test job, a job numbered by its Click number. The dispatch request reached the inbox titled
"Turnaway: — <job name> — Site not ready". The Leave report window's heading showed the same dash.
The card's header above them read the number correctly. Two older Turnaways on the same job carry
the number.

## Today

- `src/components/jobMode/DashboardJobModeCard.tsx` builds `leaveReportTarget` with
  `hcpNumber: safeTrim(cb.hcp_number) || '—'` for the current block and the same for an
  off-schedule job. It ignores `click_number`, though both rows load it.
- Leave report and Turnaway show that `hcpNumber` in their headings. The % done stepper uses it in
  its saved toast, which would read "Saved — — is now 50% done."
- `src/lib/turnaway.ts`: `buildTurnawayDispatchTitle` puts the number at the head of the title.
  `buildTurnawayReferenceSummary` drops a "—", so the reference only loses the number.
- The card's header uses its own `jobNumberLabel`, which reads
  `effectiveJobLedgerNumber(hcp, click)` from `src/lib/ledgerDisplayPrefixes.ts`, so it shows the
  number.
- New report's job search, `search_jobs_for_reports`, returns
  `COALESCE(hcp_number, click_number)`, so a Turnaway filed there after a search carries it.

## The fix

Fill the card's target with `effectiveJobLedgerNumber(hcp_number, click_number) || '—'`, in both
places it is built. That is the same choice the report search makes. Leave report, Turnaway and
% done then read the number with no change of their own. Read where
`src/components/dashboard/DashboardSupervisorSection.tsx` gets its row's `hcpNumber` for Leave
report, and give it the same choice if it reads `hcp_number` alone. Add a release note and a
`docs/recent-features/` fragment.

## Where it plugs in

| Piece | File |
|---|---|
| The card's target | `src/components/jobMode/DashboardJobModeCard.tsx` → `leaveReportTarget` |
| The number | `effectiveJobLedgerNumber`, `src/lib/ledgerDisplayPrefixes.ts` |
| The Turnaway words | `src/lib/turnaway.ts` |
| The windows | `src/components/jobMode/TurnawayModal.tsx`, `src/components/AdditionalReportModal.tsx`, `src/components/dashboard/FieldPctUpdateModal.tsx` |

## How to verify

A render test of the card on a Click-numbered job: the Leave report target and the Turnaway title
carry the number, and a job with neither number still reads "—". Live is optional. If you run it,
file a Turnaway on a ZZ test job only, read the dispatch title, then close the request with a note
and delete the Turnaway report.
