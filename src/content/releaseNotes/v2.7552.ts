import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7552',
  date: '2026-11-16',
  title: 'Sub papers: every paper carries a number (sub labor train)',
  kind: 'feature',
  highlights: [
    'A sub’s papers are now numbered as you print or download them. A work statement is numbered for its job, like WS-2041-1, and keeps that number for good. A statement of account takes the next number, like SA-0007.',
    'Printing the same work statement again keeps its number. A back-charge or a payment after the first copy makes revision 2, and its foot says which copy it replaces.',
    'A statement of account now opens on Since the last statement, once one has been made for the sub. The first one is to date.',
    'A paper that cannot be numbered is not made, and the window says why.',
  ],
}

export default note
