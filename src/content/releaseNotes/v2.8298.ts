import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8298',
  date: '2026-11-22',
  title: 'Sub papers: a work statement is confirmed once, whatever two presses do',
  kind: 'fix',
  highlights: [
    'A sub’s confirm of a work statement is kept once per copy. Two presses at the same moment leave one record, with one time.',
    'Confirming is still switched off, so nothing changes on a sub’s page today.',
    'A copy made after the sheet changed is a new copy and takes its own confirm.',
  ],
}

export default note
