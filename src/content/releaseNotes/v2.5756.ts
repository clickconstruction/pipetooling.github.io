import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5756',
  date: '2026-10-23',
  title: 'Legal: color the Texas counties each collections law firm covers',
  kind: 'feature',
  highlights: [
    'Settings → Jobs & billing → Collections law firms now holds more than one firm, with Add a firm, so the San Antonio firm and the Austin firm can both stand.',
    'A Texas county map sits beside the firm cards: pick a firm, click counties to color them for it, click again to clear, then Save counties.',
    'A county another firm holds is never taken over silently: the click says whose it is and asks before it moves. A county nobody covers stays gray.',
    'The Legal desk still releases to the first firm for now; the next release picks the firm from the account’s county.',
  ],
}

export default note
