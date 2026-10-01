import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4328',
  date: '2026-10-01',
  title: 'Pipeline and Accounts Receivable: the payer remembers a check that came back',
  kind: 'feature',
  highlights: [
    'The pay history under a Billed row now says when the bank sent back their checks in the last year. It reads 2 checks came back · Apr.',
    'It counts against whoever pays the bill, so a GC’s bounced check counts against the GC.',
    'A new deposit from the same payer in Accounts Receivable carries the same words.',
  ],
}

export default note
