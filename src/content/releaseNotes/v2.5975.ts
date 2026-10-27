import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5975',
  date: '2026-10-27',
  title: 'What everyone sees draws every frame after an update, and names the customer\'s side',
  kind: 'fix',
  highlights: [
    'The frames load one after another, so the first visit after an update draws all six, not one.',
    'A frame that comes up empty loads once more by itself.',
    'The people outside the company have their own row, Who, outside, so the two Subcontractors are told apart.',
    'On a phone, each knob\'s name sits above its buttons.',
  ],
}

export default note
