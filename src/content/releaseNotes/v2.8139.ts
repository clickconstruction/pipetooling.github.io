import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8139',
  date: '2026-11-20',
  title: 'Document builder: a new line on the insurance sheet never takes a removed line’s place',
  kind: 'fix',
  highlights: [
    'On Insurance requirements for subs, removing a line from your usual and adding another no longer hands the new line the old one’s place. A job’s change to the old line, or its choice to leave it off, cannot land on the new line.',
    'The same holds for an opening line, and for a line added on one job.',
    'Publishing a job’s sheet lets go of the job’s changes to lines your usual no longer has. They were not on the page, so the page reads the same.',
  ],
}

export default note
