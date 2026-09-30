import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4221',
  date: '2026-09-30',
  title: 'The Bridge: Vectors by the day reads recorded time, so this week is not blank',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Vectors by the day now counts every closed session that is not rejected or revoked — the reading job costing uses — so the days you most want to read, this week and last, are on the grid before approvals catch up. Hours still waiting on approval draw with a dashed border and say so on hover and on the card.',
    'A Recorded time · Approved only switch beside the zoom row flips the reading; the choice is remembered on this browser. The pay-week table above stays on approved time, so payroll and the grid never disagree about what was paid.',
  ],
}

export default note
