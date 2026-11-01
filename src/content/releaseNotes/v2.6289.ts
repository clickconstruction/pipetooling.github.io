import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6289',
  date: '2026-11-01',
  title: 'My email: later mail lands until a conversation goes quiet',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Later mail in a tagged conversation lands on the job until 60 days after its newest mail. A new tag keeps it landing for 60 days, however old the mail is.',
    'A conversation the app could not read once is read again in its turn. Before, one failed read could stop its later mail for good.',
  ],
}

export default note
