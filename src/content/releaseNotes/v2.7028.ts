import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7028',
  date: '2026-11-12',
  title: 'Pay calendar: a billed row says the day the contract makes it due',
  kind: 'feature',
  highlights: [
    'A bill for a payer on a pay calendar reads Due on the Pipeline, with the day the contract makes it due. Past that day the row turns amber.',
    'The line under it says when their money usually lands: the due day plus how late they usually run.',
    'The payment forecast shows each such bill with its due day, in the week their money is expected. The Lien desk reads the same day.',
    'The calendar opens from a billed row and from the payer in Pay speeds, as well as from the customer. A payer with no calendar reads as before.',
  ],
}

export default note
