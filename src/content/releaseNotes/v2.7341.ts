import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7341',
  date: '2026-11-15',
  title: 'One bill can have a due day of its own',
  kind: 'feature',
  highlights: [
    'Under a billed row’s dates, press This bill is due on… to set the day one bill is due, with the clause that says so. Use it for a retainage release or a dated draw.',
    'That day wins over the job’s pay calendar and the customer’s, for that one bill. The row reads Due on that day, with This bill’s own day under it.',
    'The payment forecast, Call mode, Money waiting, Accounts Receivable and the Lien desk read the same day.',
    'Press Change this bill’s day… to change the day or to clear it. A date the customer named still wins the expected day.',
  ],
}

export default note
