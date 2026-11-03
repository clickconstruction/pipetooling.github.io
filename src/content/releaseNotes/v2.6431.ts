import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6431',
  date: '2026-11-03',
  title: 'The rate the company charges for an hour has a home in Settings',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Settings → Jobs & dispatch → Rate charged for an hour holds the company’s rate, $285.00 an hour to start. It is never the wage a worker is paid.',
    'A job can carry its own rate; the hours statement window will set it in the next release, when the charged paper arrives.',
  ],
}

export default note
