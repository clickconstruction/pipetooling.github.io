import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2585',
  date: '2026-09-01',
  kind: 'feature',
  title: 'Apply the obvious deposits in one pass',
  highlights: [
    'When deposits each match exactly one open bill to the cent, Accounts Receivable shows a green bar — "3 deposits each match exactly one open bill — $5,145.72" — with Review & apply.',
    'The review panel lists every pair (deposit → bill); un-tick any you\'re not sure about and apply the rest in one pass.',
    'Ambiguous amounts — several deposits or several bills at the same figure — are listed as skipped, never guessed.',
    'Bills sent through Stripe stay manual: they keep their paid-outside-Stripe confirmation.',
  ],
}

export default note
