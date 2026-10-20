import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5505',
  date: '2026-10-13',
  title: 'Job Mode: message the customer from the job',
  kind: 'feature',
  roles: ['dev', 'primary', 'helpers'],
  highlights: [
    'A tech clocked in on a job can text its customer from Job Mode with Message the customer.',
    'Pick a line the office put on the phone, type only what the app cannot know, and check it before it goes.',
    'The customer’s answer comes back to the tech until the end of their day. The office sees it too.',
    'Texts go once the owner turns them on in Settings, under Phone and texts.',
  ],
}

export default note
