import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7019',
  date: '2026-11-12',
  title: 'Payment forecast: the Email button says what it sends, and the close button is easier to press',
  kind: 'feature',
  highlights: [
    'The button at the top of Payment forecast now reads Email this forecast… beside a proper envelope icon. It opens the same window as before, where you pick who gets the email and when.',
    'The close button is a full-size press that matches the Email button, with a highlight when you point at it.',
    'The words under the title stay to the left of the two buttons, so nothing runs underneath them.',
    'On a phone the close button is a full thumb press beside the title, and Email this forecast… sits on its own row under the words.',
  ],
}

export default note
