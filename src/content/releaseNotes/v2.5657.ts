import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5657',
  date: '2026-10-20',
  title: 'Send the pay page puts the bill in the message',
  kind: 'fix',
  roles: ['estimator', 'primary', 'dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Send the pay page under a won bid now opens the text or email with the bill’s number, what is still open and its pay page. Before, an estimator got an empty box and no way to add the link.',
    'Typing /bill in that box lists the job’s bills, for the job’s estimator too.',
    'A greeting to a company no longer reads “Structura,, this is Wendi”.',
  ],
}

export default note
