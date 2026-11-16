import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7374',
  date: '2026-11-15',
  title: 'Box labels: stop a run, print the rest, and pick a range',
  kind: 'feature',
  highlights: [
    'While tape labels print, the window names the box and the strip, like Printing 7 of 455 · G2, strip 2 of 5, with Stop printing beside it. Press it and one more strip prints, so the printer can cut the tape, and nothing is left inside the printer.',
    'A run that stops part way, by your press or by the printer, keeps the rest. The boxes that are done are unticked and named, and a box that was part way prints only its missing strips. The press counts exactly what is left, where it used to start again from the first box.',
    'Print labels has From and to above the copies, with a count like 86 of 91 boxes. Pick the first and the last box and every box between the two is ticked.',
    'Print blank stickers has the same Stop printing, and From and to over the numbers of the run on the page, so part of a run can be printed again.',
  ],
}

export default note
