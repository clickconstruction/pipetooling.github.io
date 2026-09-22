import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3704',
  date: '2026-09-22',
  title: 'Dashboard: one lien card that leads with the next deadline',
  kind: 'feature',
  highlights: [
    'The two lien cards are one. It leads with the next deadline whatever it is — “Next lien deadline: Oct 15 · in 23 days” — grey beyond two weeks, amber inside, and red inside seven days, when it reads “4 lien windows close in 5 days” and says what is lost if they are missed.',
    'One line says how many notices, to which GCs, and where they stand on the desk; the figure is the money behind that deadline, not the whole desk.',
    'Windows that closed with nothing recorded are one quiet line under the card — “5 windows closed with nothing recorded · $51,780 · note them ›” — that opens the desk’s Missed lens. The red paragraph naming every job is gone.',
  ],
}

export default note
