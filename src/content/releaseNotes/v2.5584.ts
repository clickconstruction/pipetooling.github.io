import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5584',
  date: '2026-10-16',
  title: 'Training: every press and row is a full finger tall on a phone',
  kind: 'fix',
  roles: ['helpers', 'subcontractor', 'primary', 'master_technician', 'superintendent'],
  highlights: [
    'On a touch screen the Training card’s press, the course page’s lesson rows, answer rows, Try again, Next lesson and Back to the Dashboard are all 44 px tall. The desk keeps its sizes.',
    'The rule shipped earlier today but lost to the elements’ own sizes; measured live on a phone now.',
  ],
}

export default note
