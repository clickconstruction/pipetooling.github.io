import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5706',
  date: '2026-10-21',
  title: 'Messages: the estimate text opens the estimate, and moves onto the job it becomes',
  kind: 'feature',
  highlights: [
    'A text that carried the estimate link now carries Open estimate #166 under its words, like our estimate email does.',
    'When an estimate becomes a job, the texts that carried its link move onto that job, so the job’s own thread view shows them and they stop reading "no job".',
  ],
}

export default note
