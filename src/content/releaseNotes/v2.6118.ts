import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6118',
  date: '2026-10-30',
  title: 'The job window’s lien papers name the trade as the kind of work, not the job’s name',
  kind: 'fix',
  highlights: [
    'The Mechanic’s lien tab in the job window filled paragraph 4 of the affidavit, the kind of work furnished, with the job’s name. A job named for its customer swore the customer’s name as the work. It now reads the job’s trade: Plumbing labor and materials, Electrical labor and materials, and so on, the same words the Lien desk’s draft has used since the fix on job 838.',
    'The tab’s § 53.056 notice said Plumbing labor and materials on every job. It reads the trade too, so an electrical job’s notice says electrical.',
    'The window reads the trade from the job’s full record when it opens, so the papers name it even when the board row it was opened from does not carry it.',
  ],
}

export default note
