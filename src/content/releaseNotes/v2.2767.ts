import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2767',
  date: '2026-09-04',
  title: 'Sub sheets have stages, and subs can tell you the work is done',
  kind: 'feature',
  highlights: [
    'Every Sub Labor sheet now sits at one of three stages: Waiting on work, Waiting on walk-through, Waiting on customer. Step it forward or back from the chip on Jobs → Sub Labor or inside the sheet editor; Paid sets itself when the balance hits $0.',
    "The sub's portal shows the same steps as a four-dot tracker under each job, with a plain-words line that says what stands between them and the money, in English or Spanish.",
    'Subs can press "My work here is done" on a job and add a note for the walk-through; the sheet moves to Waiting on walk-through by itself. The office gets a dispatch note, and the job\'s Activity feed gets a line for every stage move, whoever made it.',
  ],
}

export default note
