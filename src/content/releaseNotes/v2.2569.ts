import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2569',
  date: '2026-09-01',
  title: 'Accounts Receivable shows only real deposits again',
  kind: 'fix',
  highlights: [
    'On a fresh browser, the Accounts Receivable bank list could load the entire bank feed — card purchases, transfers, everything — instead of just customer deposits. It now waits for the deposit filter before listing anything.',
    'A slow unfiltered load can no longer overwrite the correctly filtered list after it appears.',
    'A connection blip while opening Accounts Receivable can no longer silently reset the company-wide deposit filter.',
  ],
}

export default note
