import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5362',
  date: '2026-10-12',
  title: 'Messages: press and hold a message to tie it to a job on a phone',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone, press and hold a message in a thread. It turns darker, and a list of the person’s jobs opens as you lift your finger.',
    'The job their new messages land on comes first, and the job the message is on now says so.',
    'Another job… finds any other job, and Untie it takes the message off its job.',
    'Pressing no job on a message opens the same list on a phone.',
  ],
}

export default note
