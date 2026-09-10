import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3240',
  date: '2026-09-10',
  title: 'Edit Job: the status rail shows which stages you can move to',
  kind: 'feature',
  highlights: [
    'The Waiting → Working → Ready to bill → Billed → Paid row on the Edit tab is now a rail with three looks: black is where the job is, a blue outline is one tap away, and dashed grey can\'t be reached from here. Tap a dashed stage and a line underneath says why.',
    'Collections is a switch on its own row under the rail, on only for Billed jobs. The empty space above the row is gone and "Status" reads like the other field labels.',
  ],
}

export default note
