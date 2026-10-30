import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6107',
  date: '2026-10-30',
  title: 'Legal desk Timeline: a strip of days on top, the counts as chips, and the overdue steps in red',
  kind: 'feature',
  highlights: [
    'The Timeline opens with a strip of days, one column a day from before the first entry to the last deadline in reach: a filled dot for a done step, a ring for a planned one, a red ring for an overdue one, a diamond for a lien-clock deadline. Press a day to jump to it.',
    'The counts read as chips with numbers — planned 7 · overdue 2 · done 10 · deadlines 3 — instead of a sentence.',
    'An overdue step wears a red rule down its left edge and offers Mark done first. A sent or received paper wears its state as a chip, with the full sent-to record on the hover instead of printed under every title.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
