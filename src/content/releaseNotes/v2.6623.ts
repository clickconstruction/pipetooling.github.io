import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6623',
  date: '2026-11-07',
  title: "The matter's narrative edited a section at a time from the dev seat",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The dev seat can now change the narrative for the firm one section at a time by its heading, the same way it edits a person's HR documents, with a plan that shows the words removed and added before anything is saved.",
    'A plan commits to the version it read. If anyone saves the narrative in between, the apply is refused and the agent plans again from the fresh text.',
  ],
}

export default note
