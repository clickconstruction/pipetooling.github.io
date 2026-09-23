import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3791',
  date: '2026-09-23',
  title: 'A returned check tells you itself — on the Dashboard and in Accounts Receivable',
  kind: 'feature',
  highlights: [
    'When the bank returns a check that was already matched to a job, the Dashboard’s Needs you card now says so: “A deposit the bank returned is still counted as paid ($13,680)”, naming the job, the amount and the bank’s reason. Until now the job kept reading paid — on the Pipeline, in its balance and on any lien notice — until someone happened to open its payments table or heard from the bank.',
    'The card’s button opens the job on ③ Payments received, where the row already wears Returned by the bank and Unlink and remove takes the payment off the job and marks the deposit returned in Accounts Receivable — the same two steps as before, just found for you.',
    'In Accounts Receivable, a returned check nobody had matched yet no longer sits in To match looking like money to apply. It leaves the pile on its own, is never swept or closed out, and under To match · All wears a chip with the bank’s words — returned by the bank · Insufficient funds.',
    'Only a deposit that posted and was then returned counts. A check the bank never accepted in the first place (Mercury’s “there was an issue with this transaction”, usually re-deposited) raises nothing, and nothing is written on its own — the app reads what the bank said; the office still presses the button.',
  ],
}

export default note
