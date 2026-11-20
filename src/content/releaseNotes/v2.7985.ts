import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7985',
  date: '2026-11-19',
  title: 'Values in place: one way to draw a value you can change',
  kind: 'infra',
  highlights: [
    'A shared piece now draws a date, a count, a name or an amount apart from the words around it.',
    'An underlined, tinted value is one you can change. Press it and it becomes its own box right there, with Keep and Cancel.',
    'A bold value is one the app works out. It updates by itself.',
    'No screen uses the piece yet. Before we start is the first, and other screens follow one at a time.',
  ],
}

export default note
