import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5498',
  date: '2026-10-13',
  title: 'Settings → Flows: change the residential customer’s and the sub’s steps too',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Flows in Settings now has a Residential customer tab and a Sub tab beside the other three.',
    'You change their steps, reminders and papers the same way, and Save keeps them.',
    'These two flows do not show who is on them yet. Their preview and How it is going say so.',
  ],
}

export default note
