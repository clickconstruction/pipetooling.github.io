import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5495',
  date: '2026-10-13',
  title: 'Settings: type the two inboxes’ addresses and numbers',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Settings, Phone and texts, now has an Inboxes card for the team inbox and the bids inbox.',
    'The owner or a dev types each inbox’s email address, phone and Quo number id. The office can read them.',
    'An empty field keeps today’s company number or bids@.',
    'The app starts using these once the two inboxes are switched on.',
  ],
}

export default note
