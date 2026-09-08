import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3160',
  date: '2026-09-08',
  title: 'The job window shows when a supply house job account is on file',
  kind: 'feature',
  highlights: [
    'The storefront icon in the job header turns teal once a job-account packet has gone out for the job — hover it to see who got it and when, click it for the history or to resend. Before, you had to open the share modal to find out.',
    'Parts Cost → Supply house invoices now chips each invoice that’s on the job account and sums how much of the unpaid balance is the owner’s exposure, not yours.',
  ],
}

export default note
