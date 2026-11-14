import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7258',
  date: '2026-11-14',
  title: 'The check of the live Settings tabs passes again',
  kind: 'fix',
  highlights: [
    'After every deploy a check opens each Settings tab on the live app. It had failed on every run since November 13.',
    'The Activity logs list is now called Most recent notifications, and the check still looked for its old name. It looks for the new one now.',
  ],
}

export default note
