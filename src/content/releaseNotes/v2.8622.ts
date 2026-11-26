import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8622',
  date: '2026-11-26',
  title: 'The Bridge: each step on the pipe says which way its work is heading',
  kind: 'feature',
  highlights: [
    'Under each step on the Bridge’s pipe, a line now says whether the work waiting in front of it grows or shrinks each week, and by how much. A step whose two paces are close reads Keeps up.',
    'Market and Sales hold no pile, so their lines say how far short of the field they run, or how far ahead. Market’s line appears once its worth is read.',
    'The red step does not move. The page still lights the step with the most weeks of work waiting, so you can read the two side by side on your own numbers.',
    'The guide Read the Bridge says what the line means.',
  ],
}

export default note
