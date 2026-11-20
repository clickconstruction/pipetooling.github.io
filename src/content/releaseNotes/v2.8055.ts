import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8055',
  date: '2026-11-20',
  title: 'Job updates: the Customer pill stays on the row with the others on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, the pills over Job updates in Job Mode now stand on one row. Before, Customer sat alone on a second row.',
    'The pills keep their height. Only their sides came in.',
    'On a smaller phone, or when the row holds more pills, the row slides sideways and does not wrap.',
    'At a desk, and in the office’s job window, the pills wrap as they did.',
  ],
}

export default note
