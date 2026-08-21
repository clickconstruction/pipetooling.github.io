import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2034',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Draft Payroll: catch up on weeks that never got a report',
  highlights: [
    'Draft Payroll now scans the 8 weeks before your period for people with hours but no pay report — an amber "Earlier unreported" button appears when it finds any (and "Earlier weeks ✓" when clean).',
    'The catch-up list shows each person-week with hours and estimated cash due; Report generates the pay report for that week on the spot, then the row flips to View / Record payment.',
    'Open week points Draft Payroll at that week when you want the full pre-flight first, and Scan 8 more weeks keeps looking further back.',
  ],
}

export default note
