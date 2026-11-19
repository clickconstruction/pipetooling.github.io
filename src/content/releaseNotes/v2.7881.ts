import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7881',
  date: '2026-11-18',
  title: 'The sub’s page says how long this customer usually takes',
  kind: 'feature',
  highlights: [
    'A sheet waiting on the customer can now carry one more line: This customer usually pays 4 to 6 weeks after we ask.',
    'The line is in weeks, with the word usually. It never shows days, an amount or the customer’s name.',
    'It shows only for a customer with five or more payments in the last 12 months. It goes away once the customer pays.',
    'The sheet’s row on Jobs → Subs → Pay says the same: Sub sees: usually 4 to 6 weeks.',
  ],
}

export default note
