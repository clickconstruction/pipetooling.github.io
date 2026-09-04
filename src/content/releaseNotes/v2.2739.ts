import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2739',
  date: '2026-09-04',
  title: 'Wheels counts card fuel only, and names the cards nobody is linked to',
  kind: 'fix',
  highlights: [
    'Only debit-card purchases in the fuel tag count as someone’s fuel. A supplier payment that was filed under a vehicle label is shown as a label check instead of as “fuel with no person on it”.',
    'The “no person on it” line now lists the cards — by nickname — so you can link each one in Banking → Sorting → User Card Link.',
    'Review applies the same rule: a person’s deal keeps only their card fuel out of the job purchases.',
  ],
}

export default note
