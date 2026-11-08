import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6671',
  date: '2026-11-08',
  title: 'Wheels gives fuel to the same person Spending and Review do',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'People → Vehicles → Wheels now reads fuel by person from the same card-charges read and rule as People → Spending: a charge is the person it is attributed to, else the holder of the card it was bought on. A fill-up on a held card with no attribution counted for no one on Wheels while Spending and Review’s fuel on no job gave it to the holder; the three screens now agree.',
    'The line about fuel with no person on it lists only fuel that reaches no one: no attribution and a card with no holder. A fuel-tag charge on a company card is set aside as before unless someone is attributed, and then it is theirs.',
  ],
}

export default note
