import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7566',
  date: '2026-11-17',
  title: 'Tagging a teammate in a job note is easier on a phone',
  kind: 'feature',
  highlights: [
    'Type @ in a job note and the names show as big presses at the box. On a phone the keyboard stays up when you press one.',
    'The names stay up when you type a space, so "@chris b" still offers every Chris whose last name starts with B.',
    'A tagged name is shaded in your words while you write. One Backspace right after it takes the whole name off.',
    'When you answer a tagged note, the person who asked is offered above the box. One press tags them back.',
  ],
}

export default note
