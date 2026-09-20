import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3641',
  date: '2026-09-20',
  title: 'Materials: the Job Accounts tab is now called Held for suppliers',
  kind: 'feature',
  highlights: [
    'Materials → Job Accounts is now Materials → Held for suppliers. The tab has always shown customer money in against supply-house money out, job by job, and its headline number was already "held" — the name now says so.',
    '"Job account" now means one thing everywhere: the account a supply house opens for a job, the one you ask the rep for before buying parts.',
    'Nothing else moved. Dashboard and Pipeline links still open the same tab, and the numbers are the same.',
  ],
}

export default note
