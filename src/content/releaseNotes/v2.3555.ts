import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3555',
  date: '2026-09-17',
  title: 'Estimates: the customer can approve a choice plus add-ons',
  kind: 'feature',
  highlights: [
    'When an estimate offers add-ons (the office switch arrives in the next release), the acceptance page shows two groups — Choose one, and Add to it — and the customer ticks any add-ons they want with their choice.',
    'The total card, the Approve button and the signed document follow the whole selection: Approve "Replace 50-gal" + 2 add-ons — $5,740.00, with each option\'s lines grouped under its own heading.',
    'An estimate made only of add-ons asks the customer to pick what they want done and needs at least one tick before Approve lights up.',
    'Estimates with plain choices look and work exactly as before.',
  ],
}

export default note
