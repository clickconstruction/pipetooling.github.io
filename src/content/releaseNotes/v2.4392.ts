import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4392',
  date: '2026-10-02',
  title: 'Materials: check the prices you spend the most on, in one window',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'Check 20 prices on the What your materials cost card lists the 20 parts you spend the most on, oldest price first.',
    'Type today’s price, or press Same if it has not changed. Either way the price counts as fresh.',
    'The window warns you when a new price is a big change. The card reminds you when the oldest check is over 30 days old.',
  ],
}

export default note
