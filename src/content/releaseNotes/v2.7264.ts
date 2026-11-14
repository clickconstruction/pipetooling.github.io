import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7264',
  date: '2026-11-14',
  title: 'The box page answers a locked connection the same way for every code',
  kind: 'fix',
  highlights: [
    'A connection that has guessed too many wrong label codes in an hour now hears the same refusal for a sticker code too, blank or lost. Until now a locked connection could still learn which sticker numbers exist.',
    'A scan from a phone that has not been guessing is unchanged.',
    'The dev seat\'s read of a job\'s materials now names all seven of its write verbs, the job move, the box edit and the part rename with the first four.',
  ],
}

export default note
