import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2131',
  date: '2026-08-22',
  title: 'GC Review: "Draft Message", the GC\'s pill first, a cleaner subject',
  kind: 'fix',
  highlights: [
    'The certify checklist\'s blue button is now "Draft Message" — it certifies and opens the statement email as a draft; nothing sends until you click Send statement.',
    'In the statement email, the GC\'s own pill comes first and is lit, because their email is already in the To line. Teammate pills follow.',
    'Default subject is now "Click Plumbing open balances: Aug 22, 2026" (was "Open balances — Click Plumbing and Electrical — Aug 22, 2026"). Scheduled sends use the same subject once the dispatcher is redeployed.',
  ],
}

export default note
