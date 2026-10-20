import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5443',
  date: '2026-10-13',
  title: 'Messages: text or email a job’s customer from the job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The note box in a job’s window has Note, Text and Email over it.',
    'Text and Email write to the job’s customer in orange, with the quick replies, and tie the message to the job.',
    'Note is the crew’s note on the job, as it was.',
  ],
}

export default note
