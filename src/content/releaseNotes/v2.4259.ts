import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4259',
  date: '2026-09-30',
  title: 'Job Parts Tally reads every charge on a card, not just the newest 1,000',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'A card with more than 1,000 charges since its link used to load only the newest 1,000, silently. The date floor and the payroll marks then ran over that shorter list, so the unlinked count and the Payroll total on the Transactions tab could read low.',
    'The tab and the clock-out purchases check now read the whole list in pages, so every charge is counted.',
  ],
}

export default note
