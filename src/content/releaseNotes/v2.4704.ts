import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4704',
  date: '2026-10-07',
  title: 'Lien desk: the pay offer reaches the bills',
  kind: 'feature',
  highlights: [
    'When the run is recorded, every Stripe bill behind a notice with an offer gets the discount as a credit on the bill. The code on the pay page, and Stripe’s own emails, show the lower amount until the day.',
    'The page the code opens shows the full amount struck through, the lower one large, and the day. After the day it shows the full amount and says the offer ended. A paid bill says it was paid with the offer.',
    'A bill paid in full by the day is written down by the percent in Billing, with a note naming the offer and the day, the moment the payment lands. An affidavit always swears the full balance, because the ledger changes only when a bill is paid.',
    'A few minutes after midnight every night, any offer whose day passed unpaid is taken back, and the bill goes back to its full amount on its own.',
  ],
}

export default note
