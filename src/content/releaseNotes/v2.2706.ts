import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2706',
  date: '2026-09-03',
  title: 'Person Desk: pay, schedule, and the two hard days',
  kind: 'feature',
  highlights: [
    'The drawer gains Pay & schedule: wage and office rate, the Salaried switch (with the same warning Employment shows before turning it off), employment dates, upcoming time off, the salaried workday schedule, the last pay report and open offsets, with Ledger, Payroll and Add offset one tap away.',
    'End employment: the ⋯ menu opens a checklist of everything still open for that person — a running clock, sessions waiting, the final pay report, a sub balance, a live portal, a truck, housing, team leads, work orders, missing paperwork — each with its one-tap fix or a "leave open" with a reason. The button will not finish while anything is unresolved.',
    'Start employment: the mirror checklist — start date, wage, team lead, packet, truck and housing — so a new helper is set up from one screen.',
    'Ending employment writes the end date, optionally archives the account (dev), and appends one factual line to the HR file (dev).',
  ],
}

export default note
