import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7374',
  date: '2026-11-15',
  title: 'Box labels: stop a run, print the rest, and pick a range of boxes',
  kind: 'feature',
  highlights: [
    'While tape labels print, Stop printing sits beside Printing 6 of 455. Press it and one more strip prints, so the printer can cut the tape, and the run ends with nothing left inside the printer.',
    'A run that stops part way, by your press or by the printer, unticks the boxes that printed and names them. The print press then prints the rest, where it used to start again from the first box.',
    'Print labels has From and to above the copies. Pick the first and the last box and every box between the two is ticked, so G6 to G91 is two picks.',
    'Print blank stickers has Stop printing too, and its press reads Print the rest with the numbers still to go.',
  ],
}

export default note
