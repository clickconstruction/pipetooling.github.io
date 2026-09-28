import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3914',
  date: '2026-09-27',
  title: 'Edit Job: two small loaders are their own pieces',
  kind: 'fix',
  highlights: [
    'The job form read two things for itself: the customer’s standing discount (the offer above the line items) and the saved addresses of the customer and the GC (the property record’s list). Each is now a small piece of its own with tests.',
    'Nothing on screen changes.',
  ],
}

export default note
