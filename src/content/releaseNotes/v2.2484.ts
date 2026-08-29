import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2484',
  date: '2026-08-29',
  title: 'Open RFIs warn you at letter time',
  kind: 'feature',
  highlights: [
    'Next to Mark sent, a chip now counts the bid’s unanswered RFIs — the reminder that every open question must appear in the letter as an assumption or exclusion. Hover it to read them.',
    'Under the hood, agent seats are now physically unable to mark bids sent or record win/loss — drafting stays theirs, commitments stay yours.',
  ],
}

export default note
