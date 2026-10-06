import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4654',
  date: '2026-10-06',
  title: 'Job Parts Tally: sort the team’s card charges one day at a time',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Job Parts Tally → Transactions now opens on Team for the office. Each card is one person’s day: when they clocked in, where, and every charge they made.',
    'The likely job comes first, with the reason under it. Nothing is picked until you tap. Sort the day saves every charge you picked.',
    'Invoices, Backcharge and the full job picker are on every charge. My card shows only your own card, as before.',
  ],
}

export default note
