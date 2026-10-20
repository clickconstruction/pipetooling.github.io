import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5540',
  date: '2026-10-14',
  title: 'Phone and texts: Reply push shows the office’s wait, and the owner can change it',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'Under Reply push on Settings → Phone and texts, the office’s wait now shows: how long the app waits for whoever has a conversation before the office hears a reply too. It started at 15 minutes, and until now only a developer could change it.',
    'Type the minutes and press Save the wait. 0 means the office hears at once, with whoever has it, so a team that shares one number hears every reply together.',
  ],
}

export default note
