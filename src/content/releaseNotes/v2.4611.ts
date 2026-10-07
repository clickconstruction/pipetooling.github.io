import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4611',
  date: '2026-10-05',
  title: 'Groundwork: card refunds count in who is spending what',
  kind: 'infra',
  highlights: [
    'The read behind the coming People → Spending tab now counts a refund to a company card, like a return at the store or fuel given back at the pump.',
    'The bank files these refunds differently from purchases, so the read left them out. Job costs always counted them.',
    'Nothing on screen changes yet.',
  ],
}

export default note
