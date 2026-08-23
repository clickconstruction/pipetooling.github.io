import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2176',
  date: '2026-08-23',
  title: 'Phone fixes: Vehicles and Customers no longer run off the screen',
  kind: 'fix',
  highlights: [
    'People → Vehicles: opening a vehicle pushed the whole page wider than the phone (the Ledger filter chips were one fixed row). The chips wrap now, and ledger rows put their description on its own line when the row is tight.',
    'Customers: each row\'s chips and PAID / BILLED / UNBILLED rail sat beside the name and ran off the right edge at phone width — they now drop under the name as one wrapping row.',
    'Swept Dashboard, Jobs (Pipeline, Sub Labor, Billing), Quickfill, Schedule, Bids, Estimates, Projects, Prospects, Checklist, Materials, Settings, Partnerships, People Hours and the customer page at 375px — all fit.',
  ],
}

export default note
