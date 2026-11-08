import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6692',
  date: '2026-11-08',
  title: 'The Pipeline’s phone rows show the customer’s newest line',
  kind: 'fix',
  highlights: [
    'On a phone, a Pipeline row now gains a third, smaller line when the newest thing on the job is a text, an email or a call with the customer: who, how it came, how long ago and the first words, in orange. While the customer wrote last and nobody has answered, the line says so.',
    'Press the line and the speech bubble’s window opens, with the thread and the Text and Email presses. A press anywhere else on the row still opens the job.',
    'The team’s notes and reports stay off the phone row, which keeps its two lines and one chip. The last release said the phone card drew this line, but the phone had stopped drawing that card; this release puts the line on the rows the phone does draw.',
  ],
}

export default note
