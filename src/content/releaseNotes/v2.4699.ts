import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4699',
  date: '2026-10-06',
  title: 'Help: every numbered step gives its instructions as commands',
  kind: 'improvement',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'customer', 'estimator'],
  highlights: [
    'In 25 help guides, 63 sentences inside numbered steps read "You press…" or "Then you tap…". They now read "Press…" and "Then tap…", like the steps around them.',
    'Sentences that describe what you see, and sentences in running text, still say "you". Nothing else in the guides changed.',
  ],
}

export default note
