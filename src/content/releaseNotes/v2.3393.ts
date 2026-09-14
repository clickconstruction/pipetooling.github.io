import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3393',
  date: '2026-09-14',
  title: 'Drive pass: a street number is not a job number',
  kind: 'fix',
  highlights: [
    'Found in Drive read “105 Dover” as job 105 and offered the folder to the wrong job. A folder now matches a job by number only when the number is labelled — “J105”, “Job 105”, “#105” — so a street address never stands in for a job number.',
  ],
}

export default note
