import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6587',
  date: '2026-11-06',
  title: 'Leave a note for a teammate who is away: they sign in and find the one screen you wrote for them (punch list #256, PR 8)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'On an archived desk, Leave a note… opens a window with your words, a countdown to the day back, where we are, and the office line. The right side is their screen, and it changes as you type.',
    'Save it and their sign-in opens to that screen and nothing else. Every other page, read and file stays closed to them until Bring back.',
    'End employment offers the same window before the finish. Take the note down and their sign-in closes again; Bring back takes it down for you.',
  ],
}

export default note
