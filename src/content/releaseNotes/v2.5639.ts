import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5639',
  date: '2026-10-19',
  title: 'A job’s text box shows all the quick replies at once',
  kind: 'fix',
  highlights: [
    'Text or Email from a Pipeline row or a job’s window opened the quick replies with only the line for the job’s stage, and read “1 for customers”.',
    'Now every saved line shows from the start, under the stage’s line, as it does in a person’s thread.',
  ],
}

export default note
