import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4198',
  date: '2026-09-30',
  title: 'The “+$ alt” chip follows the price',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The Bid Board’s “+$X alt” now appears the moment an alternate is priced, not only after the bid is marked sent — and it follows the price when the alternate is repriced.',
    'The Cover Letter tab keeps each offered alternate’s add-on current in the background; your Offer ticks and wording stay as you saved them.',
  ],
}

export default note
