import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3863',
  date: '2026-09-26',
  title: 'Pipeline: the section headers’ numbers come from one tested rule',
  kind: 'fix',
  highlights: [
    'Each Pipeline section prints a count and a total from its live rows when they are on the board, from the cached figures when they are not yet, and “…” before either — a rule that lived inside the board with the Billed list’s aging chips. Both now live in one small tested module.',
    'Nothing on screen changes.',
  ],
}

export default note
