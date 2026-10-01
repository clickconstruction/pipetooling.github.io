import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4315',
  date: '2026-10-01',
  title: 'Pipeline: the dates on a billed row read 28d ago, 23d past, 46d',
  kind: 'feature',
  highlights: [
    'The dates block on a Billed or Collections row now writes the number and the d together: 28d ago, 23d past, in 4d, and 46d beside the lien date. The line under it already read the same way, like Pays in 2–8d.',
    'The bold line under the dates follows: Can run late · 72d, Notice first · 4d short, Ask for a date · 12d past.',
  ],
}

export default note
