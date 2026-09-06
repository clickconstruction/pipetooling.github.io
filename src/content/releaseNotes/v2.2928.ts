import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2928',
  date: '2026-09-06',
  title: 'Subs pick their start day inside the window',
  kind: 'feature',
  highlights: [
    'A work order that fulfils a stage with a window is signed with dates: the sub\'s portal shows the window as a calendar, they tap the day they can start, the job\'s working days light up to its end, and Sign to accept carries the pick. "Can\'t do any of these days" sends the office a line instead.',
    'Their job card then shows "Your dates · Sep 9 – Sep 10" and lets them move the dates inside the window until the day before they start; after that the card says to call. Every pick or move drops a line in the dispatch inbox.',
    'The office sees "picked Sep 9 – Sep 10 by the sub" under the window on Jobs → Subs → Work, the sheet\'s date follows the pick, and the Forecast Sub Board bars use the picked days.',
    'The assembler gained "Takes about (working days)" so a start pick knows its end.',
  ],
}

export default note
