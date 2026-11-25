import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8555',
  date: '2026-11-24',
  title: 'Dev seat: a job it makes carries a line item with its price',
  kind: 'fix',
  highlights: [
    'A job made through the dev seat now gets one line item with its price. Its Bill tab totals the price, where it read $0.00.',
    'Before this, one edit on that Bill tab would have saved the price as $0 under a bill already sent. It can no longer happen on a job the seat makes.',
    'A price changed through the dev seat moves the job’s one line item with it. A job with several lines is refused there, and its lines are changed on the Bill tab.',
    'Planning a job’s own price again through the dev seat gives an older seat-made job the line it never had.',
  ],
}

export default note
