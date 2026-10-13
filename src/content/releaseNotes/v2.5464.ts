import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5464',
  date: '2026-10-13',
  title: 'Messages: a job set to save its photos copies them to Drive every few minutes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'On a job set to save every photo, the app looks for new photos every 5 minutes and copies each to the job’s Drive.',
    'While no job is set to save its photos, the app makes no check at all.',
  ],
}

export default note
