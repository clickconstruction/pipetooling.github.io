import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5466',
  date: '2026-10-13',
  title: 'Messages: an email can carry a job’s files, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'An email from a person’s thread can carry files from the job’s Drive, from earlier emails, or from this computer.',
    'A file too big for the email goes as our link, or as their portal at the right page. The links go under the words.',
    'A file from this computer goes into the job’s Team only folder before the email leaves.',
    'Each file is kept with the message as it went. The Attach button comes next.',
  ],
}

export default note
