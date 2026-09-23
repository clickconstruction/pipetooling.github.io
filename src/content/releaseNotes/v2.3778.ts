import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3778',
  date: '2026-09-24',
  title: 'The job-rename plan reads without writing',
  kind: 'fix',
  highlights: [
    'The dry run that lists which jobs would be renamed for their work (from v2.3766) refused to run through a read-only door. It is now a plain read, so it can be looked at from anywhere before anything is renamed.',
    'Imported jobs carrying only the placeholder line “Job total (migrated)” are left alone — that line is not the work, so those jobs keep the customer’s name.',
  ],
}

export default note
