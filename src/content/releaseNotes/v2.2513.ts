import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2513',
  date: '2026-08-30',
  title: 'Estimating robots get their own books',
  kind: 'feature',
  highlights: [
    'Each service type now carries a 🤖 Robot Default takeoff book, labor book, and price book that robots can grow as they learn each job.',
    'Robot entries stay separate from the human books — people can always review, edit, and promote them.',
    'Robots can now build the labor hours table on their own bids (a permissions gap blocked it before).',
  ],
}

export default note
