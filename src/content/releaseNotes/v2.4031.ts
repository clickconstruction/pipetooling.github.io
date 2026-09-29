import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4031',
  date: '2026-09-28',
  title: 'New Job: a line that could not be saved is now said',
  kind: 'fix',
  highlights: [
    'Create Job saves the job, then its payments, parts, line items and team one at a time. If the database refused one of those, nothing said so — the job just opened later without it.',
    'A red note now says how many of each did not save and why. The job itself is saved: open it and add them again.',
  ],
}

export default note
