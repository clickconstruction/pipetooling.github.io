import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7991',
  date: '2026-11-19',
  title: 'HR files: a person’s file says what they were, employee or subcontractor, and from when',
  kind: 'feature',
  highlights: [
    'The strip of facts at the top of a person’s HR file now reads their standing, such as Subcontractor · since Mar 3, 2025 · still engaged.',
    'Press it to open Standing. Record a stretch, change from one kind to the other on a day, end a stretch, or take one off with a reason.',
    'Each change shows on the Timeline under Employment, on the day it took hold, with where the fact comes from.',
    'Only developers see HR files. Hours, pay and the roster are not changed by any of this.',
  ],
}

export default note
