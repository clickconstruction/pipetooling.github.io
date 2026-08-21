import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1935',
  date: '2026-08-20',
  title: 'Marking a job Billed offers to create its bill line',
  kind: 'feature',
  highlights: [
    'Tapping Billed on the Edit Job status strip now pauses when the job\'s open money would land on no bill line — the state where it can\'t age, be chased, or be forecast.',
    'One tap does it right: "Create line & mark Billed" flips the status and creates the bill line dated today. "Mark Billed only" is still there when you mean it.',
  ],
}

export default note
