import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5476',
  date: '2026-10-13',
  title: 'Messages: attach a job’s files to an email',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Press Attach in the reply box to add a file from the job, from this computer, or a photo.',
    'The send window shows how each file goes: as the file, or as our link to their portal or to the file.',
    'A file from this computer goes into the job’s Team only folder before the email leaves.',
  ],
}

export default note
