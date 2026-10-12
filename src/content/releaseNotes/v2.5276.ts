import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5276',
  date: '2026-10-12',
  title: 'GC mode: asking for a renewed insurance certificate and the renewal list share one 30-day window',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The company window asks for a renewed insurance certificate on exactly the days the renewal list chases it.',
    'Both now read one setting of 30 days, so they can never drift apart.',
  ],
}

export default note
