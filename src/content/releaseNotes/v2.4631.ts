import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4631',
  date: '2026-10-06',
  title: 'Lien desk: Do now shows the steps',
  kind: 'feature',
  highlights: [
    'A rail above the Do now rows shows the four steps of a notice: Find the owner, Draft notice, Approve and Send the run, each with how many rows stand on it. Affidavits get a rail of their own when one needs an act. Press a step to see only those rows.',
    'The fourth step is the run itself. It shows how many notices are approved and waiting, and pressing it opens the run.',
    'Every row wears four dots and a count like 2/4. Point at the dots and a card says where that paper stands: what is done and when, what is waiting and on whom, what is left, the deadline and what is blocking it. On a phone, tap the dots.',
  ],
}

export default note
