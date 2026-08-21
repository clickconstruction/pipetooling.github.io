import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2009',
  date: '2026-08-21',
  title: 'Partner ledger card: one true balance',
  kind: 'fix',
  highlights: [
    "The partner's \"Your ledger\" card now headlines the settle-up number — posted balance minus charges still waiting for a statement — instead of showing the posted-only figure with the real number in a footnote.",
    'Charges waiting for a statement are counted straight into the balance (details in Full ledger); past weeks keep their statement closing balances unchanged.',
  ],
}

export default note
