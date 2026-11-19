import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7961',
  date: '2026-11-19',
  title: 'Tests, help guides and sample emails no longer match live records',
  kind: 'infra',
  highlights: [
    'The tests, the help guides and the sample emails were checked against the live customer list. Every name, job name, street address and phone number that matched a live record was swapped for a made-up one.',
    'The help guides and the sample emails under Settings, What the team sees, now show made-up names, streets and phone numbers in their examples.',
    'Nothing else on any screen changes.',
  ],
}

export default note
