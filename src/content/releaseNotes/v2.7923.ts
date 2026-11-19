import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7923',
  date: '2026-11-19',
  title: 'Permit news on the Bid Board is your own, and only when it is true of the bid',
  kind: 'fix',
  highlights: [
    'The strip Permit news on your bids now lists the bids you estimate, manage or were marked for. Other people’s lines fold behind one quiet line, and an estimator with none of their own sees no strip.',
    'A permit that names a different suite than the bid is another tenant’s. It no longer gives a line, a chip or a Mark lost… press, and the bid’s This site list says how many were left out.',
    'A plumbing permit that was there before the bid was started is not an answer to the bid. For six months it shows as a grey chip on the row, and an older one stays in This site only.',
    'A plumbing permit is news on a plumbing bid only. An electrical or HVAC bid keeps its building permit news.',
  ],
}

export default note
