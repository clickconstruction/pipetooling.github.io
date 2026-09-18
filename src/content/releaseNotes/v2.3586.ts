import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3586',
  date: '2026-09-18',
  title: 'Payroll backfill: apply only the kinds you name',
  kind: 'infra',
  highlights: [
    'The backfill can now apply only the action kinds named — links, splits, filings — so linking recorded payments to their bank sends can go ahead while the sends to record wait for a decision.',
    'Nothing changes on screen in this release.',
  ],
}

export default note
