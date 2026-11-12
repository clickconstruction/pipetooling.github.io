import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7024',
  date: '2026-11-12',
  title: 'Pay calendar: record the day a payer must have a bill by, and the day they pay',
  kind: 'feature',
  highlights: [
    'A customer who pays on a set day of the month can hold a pay calendar: the cutoff, the pay day and how many months later.',
    'Open it from the line under Pays in on the customer. The window says the calendar back in plain dates before you save.',
    'It also checks the calendar against their past payments, and says how many days after the due day the money really landed.',
    'Saving one changes no date on the Pipeline yet. The billed rows and the payment forecast read it in a following release.',
  ],
}

export default note
