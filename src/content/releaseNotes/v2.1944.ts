import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1944',
  date: '2026-08-20',
  title: 'One tap, one line on change orders',
  kind: 'feature',
  highlights: [
    'On a change order\'s Impact on cost, "+ Added work" and "− Credit / removed work" now add the line immediately — type straight into it. No more separate form with its own "Add line" button.',
    'Each tap is one line, and the buttons stay below the list so the next line is always one tap away.',
    'Credit lines still carry the "Credit — " label and credit the amount back automatically — type the price as a plain number.',
  ],
}

export default note
