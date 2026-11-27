import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8685',
  date: '2026-11-27',
  title: 'The sign-in page on a small phone: the three trades stay on one row',
  kind: 'fix',
  highlights: [
    'On a phone 375 pixels wide or less, HVAC dropped to a row of its own under Plumbing and Electrical.',
    'Now the three tiles share one row on every phone, and the sign-in form sits higher on the first screen.',
    'A wider phone, a tablet and a computer look as they did, but for the tiles on a phone now lining up with the form’s edges.',
  ],
}

export default note
