import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6855',
  date: '2026-11-10',
  title: 'Lien affidavit: a short form that says what the statute lists, drawn for every new draft',
  kind: 'feature',
  highlights: [
    'A new lien affidavit is short. Under a GC it has seven statements: your company and its address, the trade and the property, the GC with its address, the owner, the months, the notices and the claim. On a job contracted with the owner it has four.',
    'The months and the notices come from the record. The paper names each month a recorded § 53.056 notice names, inside the job’s own dates of work, and the day and method each notice went to the owner.',
    'Gone from the paper: the letterhead and the Job and Work month line, the first and last day of work, the contract amount and the amount paid, the general sentence about notices, and the words about interest, costs and fees. The county at the top is left for the notary.',
    'An affidavit drafted before this keeps the earlier form, so a paper already approved does not change. On the Lien desk, Redraw on the short form… above that paper moves it, and it then needs approval again.',
  ],
}

export default note
