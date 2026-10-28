import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6015',
  date: '2026-10-28',
  title: 'Accounts Receivable shows the retainage GCs hold on our trade jobs',
  kind: 'feature',
  highlights: [
    'A new Retainage held band under the Accounts Receivable header lists the money a GC holds back on each of our trade jobs, apart from the deposits and the bills. Each line names the job, who holds the money, the amount, and how long since the job finished, with a door to the job.',
    'The amount is the latest saved pay application’s retainage, or on a job with no pay application the figure typed in the job’s lien details, so Accounts Receivable reads the same number the AIA window saved. The clock starts the day our contract on the job ended, the day the Lien desk already uses; a job still open is not aging.',
    'Nothing is billed early. Once a release bill has gone out the line shows its figure struck through until that bill is paid, and then it leaves. Close the band to its one-line total and it opens that way next time on your browser.',
    'The window’s ? card names the band, and the guide “match bank deposits to the bills they pay” has a section on it. The release itself, and the lien details reading the pay application, follow in their own updates.',
  ],
}

export default note
