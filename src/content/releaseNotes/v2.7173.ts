import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7173',
  date: '2026-11-13',
  title: 'Materials on site: a press made with no signal is kept and sent later',
  kind: 'fix',
  highlights: [
    'On a job’s cages and boxes, a use, a count, a move or a new box made with no signal used to be lost. The screen showed it as saved, then put the old number back.',
    'A press is now kept on the phone the moment you make it. With no signal it waits, and a message says so once. The line at the top of the screen counts what waits.',
    'The presses go out by themselves when the signal is back, in the order you made them. You can close the app in between.',
    'A press whose answer was lost is sent again and still counts once. Only the office saying no takes a press off the screen, with its reason.',
  ],
}

export default note
