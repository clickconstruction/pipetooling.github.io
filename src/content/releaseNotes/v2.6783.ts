import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6783',
  date: '2026-11-09',
  title: 'The Scoreboard’s roster rate reads the same 90 days as Bids → Labor',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The rate the Scoreboard prices labor kept at now reads the 90 days ending today for the current month, the same window Bids → Labor and Settings → Line budgets read, so the three cards show one figure. A past month keeps the 90 days ending at its own end.',
  ],
}

export default note
