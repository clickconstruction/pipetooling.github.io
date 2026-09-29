import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4116',
  date: '2026-09-28',
  title: 'Bids: saving a bid that has not been sent writes only what changed',
  kind: 'fix',
  highlights: [
    'Editing a bid with no Bid Date Sent used to send eight blank "sent" checklist stamps with every autosave, and cancelling the "Confirm bid sent" checklist wrote them on their own. Those saves now carry only the fields you changed.',
    'Emptying the sent date on a bid that was sent still clears its checklist stamps, as before.',
  ],
}

export default note
