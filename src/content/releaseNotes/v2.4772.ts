import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4772',
  date: '2026-10-07',
  title: 'GC mode: the schedule’s rules move into the app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The schedule’s rules move from the GC mode prototype into the app, word for word: the first draft, the chart, moving a bar with its reason, Undo and Redo, a line in parts, where the work is, baselines, a change order’s days and what if.',
    'They are tested on the prototype’s own made-up job, so the app gives the answers the owner tried.',
    'Nothing on a screen reads them yet. The schedule’s tables come next in the GC mode real build.',
  ],
}

export default note
