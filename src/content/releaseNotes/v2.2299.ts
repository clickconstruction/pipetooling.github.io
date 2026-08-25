import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2299',
  date: '2026-08-25',
  title: 'Collected card: 30 days, tighter audience',
  kind: 'fix',
  highlights: [
    'The Pipeline "collected" money card now reads the last 30 days instead of the last 8 weeks, with a daily sparkline.',
    'Only devs and controllers see it — it no longer shows for master technicians.',
  ],
}

export default note
