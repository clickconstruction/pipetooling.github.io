import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3342',
  date: '2026-09-11',
  title: 'Bid Costs: Bid vs actual',
  kind: 'feature',
  highlights: [
    'Bids → Bid Costs has a third lens, Bid vs actual: every job linked to its bid, with what it cost to bid, what we bid, the hours and direct cost the bid predicted, and the hours the job has recorded.',
    'Each row reads itself — on the book, over, under, hours missing, or not costed — and a never-costed bid offers Cost it →, which opens its Labor tab. A count sheet that cannot be right (hundreds of hours on a small job) says "check the count sheet".',
  ],
}

export default note
