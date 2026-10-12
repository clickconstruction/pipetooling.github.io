import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5299',
  date: '2026-10-12',
  title: 'Bill day on each building job’s card, and the trades’ cut-off in Settings',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A job being built shows a Bill day pill with how many of the seven gates are clear. It opens From the trades on that job.',
    'A line on the card gives the bill day, the cut-off, and how many trades are in.',
    'Settings, under Jobs & billing, sets how many days before bill day the trades’ pay applications are due, for every job.',
  ],
}

export default note
