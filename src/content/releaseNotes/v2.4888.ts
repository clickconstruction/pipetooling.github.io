import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4888',
  date: '2026-10-07',
  title: 'Hints that named old screens now name today’s',
  kind: 'fix',
  highlights: [
    'About a dozen hover hints and notes still pointed to screens that moved, like Edit Job → Payments received or Settings → Sub portal. They now name where things are today.',
    'The training-mode banner says who can switch it off: a dev, a controller or a pay-approved leader.',
    'What the team sees prints “today’s” on the four digests, not a code.',
  ],
}

export default note
