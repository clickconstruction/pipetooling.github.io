import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6121',
  date: '2026-10-30',
  title: 'My Schedule and My day show a job’s Click number',
  kind: 'fix',
  highlights: [
    'A job with a Click number and no HCP number now shows its number on My Schedule and in My day, instead of a dash.',
    'The number matches what the Add job window shows for the same job.',
  ],
}

export default note
