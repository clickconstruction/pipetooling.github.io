import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2065',
  date: '2026-08-21',
  title: 'Sending a job back now tells the crew why',
  kind: 'feature',
  highlights: [
    'Moving a Ready to bill job back to Working now asks for a required reason — on the Pipeline board, the Dashboard pipeline, and the Edit-tab status strip.',
    "The reason lands on the job's activity thread and shows on the crew's My Schedule card (\"↩ Sent back by Roxi — needs the tunnel footage attached\"), so a returned job explains itself.",
    'The line stays on the card while the job is back in Working, and clears once it moves forward again.',
  ],
}

export default note
