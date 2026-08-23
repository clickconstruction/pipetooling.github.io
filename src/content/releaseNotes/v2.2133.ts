import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2133',
  date: '2026-08-22',
  title: 'GC statements: the footer names the office number',
  kind: 'fix',
  highlights: [
    'Statement emails now end with "Questions about a bill? Reply to this email or call the office at <number>." — the number comes from Settings → Company → invoice issuer. No number set → the old line.',
    'Applies to Send now, Copy for email, Preview, Share all, and scheduled sends (once the dispatcher is redeployed).',
    'The "Statement preview — N jobs, $X · …" blurb in the statement email dialog is gone; Preview shows the real email.',
  ],
}

export default note
