import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8320',
  date: '2026-11-22',
  title: 'In kind: the weekly GC statements email says how much an arrangement pays',
  kind: 'feature',
  highlights: [
    'The week’s GC statements email now says one line under its summary: how much on how many bills is scheduled in kind, not money owed.',
    'The line counts every GC’s bills an in kind arrangement pays, so a GC that dropped off the list is still explained.',
    'The email says nothing extra when no GC has a bill on an arrangement.',
  ],
}

export default note
