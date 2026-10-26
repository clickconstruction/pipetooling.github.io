import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5909',
  date: '2026-10-26',
  title: 'A batch button says its count',
  kind: 'feature',
  highlights: [
    'Buttons that act on many rows now say how many: Dismiss all 14 on a Banking approvals group, Mark 5 opened on the Dashboard\'s recent reports, Mark 3 read on Team feedback\'s open words, Rerun Google on 7 addresses in the Map\'s geocode review.',
    'Settings → Dashboard reads Pin for 4 users and Clear 6 page pins; Settings → Catalogs reads Remove 3 unused material part types and Delete 12 orphaned prices; Bids → Counts reads Clear all 42 counts and its confirm Delete 42 count rows.',
    'Materials → Supply houses → Apply payment reads Apply to 4 invoices, and a payment that could not be applied now says why instead of leaving the form open in silence. Partnerships → Job review reads Move 5 sessions · 12.0 h, a day\'s hours audit reads Approve 4 punches · 1 typed waits, Draft payroll reads Generate 6 reports, and the user-review ledger reads Unassign 12 shown.',
    'A build check now refuses a new Approve all or Send selected with no number on it, so the next batch button says its count from the start.',
  ],
}

export default note
