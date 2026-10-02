import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4376',
  date: '2026-10-02',
  title: 'Expected dates use a payer’s own history from their first payment',
  kind: 'feature',
  highlights: [
    'One measured payment is enough. Before, a customer needed three, and until then the company’s 6-day average stood in.',
    'Slow builders read honestly. TF Harper’s bills are expected on their own 74 days, so they read about a week late instead of 81 days.',
    'The pay history line under Expected shows from the first payment too, like Pays in ~74d.',
    'Hover Expected to see how many payments the date rests on. A payer with no history still uses the company average.',
  ],
}

export default note
