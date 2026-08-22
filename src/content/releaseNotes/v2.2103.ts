import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2103',
  date: '2026-08-22',
  kind: 'feature',
  title: 'Call sessions collect bid tabs — and tell you what to ask',
  highlights: [
    'A "Bid tab…" button on every bid in the call session opens the familiar capture (low, high, "#2 from the bottom, of 6") right in the conversation — noted instantly, written with End call & save alongside everything else.',
    'Each pending bid now carries a quiet prompt for the call: "ask: did our number land? can we get the bid tab?" on never-contacted bids, and "ask: can we get the bid tab?" once an older bid still has no tab on file.',
    'Bids with a tab already recorded say so under their row, so you don\'t ask twice.',
  ],
}

export default note
