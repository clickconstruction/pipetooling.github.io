import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7860',
  date: '2026-11-18',
  title: 'Trips: a trip put back is tied to its line again',
  kind: 'fix',
  highlights: [
    'A deleted trip that was on a job’s lines used to come back without its tie to that line. It then offered Put on a bill again, and a second press would have added a second line for the same work.',
    'Undo and Put back now tie the trip to its line again. Its chip reads where the line stands, and the door to the line is back in the press’s place.',
    'A line that was removed while the trip was gone is not made again. The trip then comes back free to be put on a bill.',
  ],
}

export default note
