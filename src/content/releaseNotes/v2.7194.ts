import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7194',
  date: '2026-11-13',
  title: 'Print labels: the Which job? window is wider and never scrolls sideways',
  kind: 'fix',
  highlights: [
    'Print labels asks Which job? in a small window. A long job name pushed the list past the window’s edge, so it scrolled sideways and cut off each job’s label count and the close press.',
    'The window is wider on a computer, and its list now stays inside it at every size.',
    'A long job name reads in full on a second line. It used to be cut short with three dots.',
  ],
}

export default note
