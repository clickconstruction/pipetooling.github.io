import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3775',
  date: '2026-09-23',
  title: 'Bill Customer no longer says "Nothing left to bill" on a job with a partly paid bill',
  kind: 'fix',
  highlights: [
    'A job with a bill that was partly paid — a $1,072.50 bill with $1,018.87 on it — read "Nothing left to bill for this job" in Bill Customer even though the Pipeline row showed hundreds of dollars still done and not billed. The paid part of that bill was being counted twice: once as a payment on the job, once as the bill itself.',
    'The remainder now counts each open bill for what is still unpaid on it. The same math runs wherever the app shows what is left to bill: Bill Customer, the Pipeline row and its Create partial invoice dialog, Edit Job → Make Invoice and its bar, and the Dashboard\'s Prepare bill button.',
    'Nothing changes for a job whose bills are unpaid or fully paid — only a bill with a partial payment on it was affected.',
  ],
}

export default note
