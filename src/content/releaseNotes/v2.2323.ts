import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2323',
  date: '2026-08-26',
  title: 'Job address preview + one-tap comma fix',
  kind: 'feature',
  highlights: [
    'The Job Address field (New Job and Edit Job) now shows a live preview of how the address will read on customer statements — street bold, city quiet.',
    'Paste an address missing the comma before its city and a one-tap "Add comma" chip offers the corrected address. It never blocks a save and never rewrites without your tap.',
    'The suggestion uses the same city list as address line-breaks (Settings → Jobs & dispatch), and Round Rock and Liberty Hill joined the built-in list.',
  ],
}

export default note
