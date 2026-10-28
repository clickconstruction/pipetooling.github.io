import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6016',
  date: '2026-10-28',
  title: 'A note, a hold or a skip on a residential customer’s step files on the Pipeline job, and the step card reads the note back',
  kind: 'fix',
  highlights: [
    'Add a note, Skip for them, Hold until and Remind now on a residential customer’s step now file on the Pipeline job. Before this the press named every job a GC project, so a Pipeline job’s id was refused with “No job with that id”.',
    'A note on a Pipeline job’s step shows on that job’s step card and reaches the morning run, instead of reading as a note on no job.',
    'Let it go now finds a hold on a Pipeline job’s step, and Follow up’s Hold until Mon and Remind now name a residential customer’s job the same way.',
  ],
}

export default note
