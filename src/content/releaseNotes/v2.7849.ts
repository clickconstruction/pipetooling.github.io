import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7849',
  date: '2026-11-18',
  title: 'Checklist: View as from a person’s Task Mode window lands on their Today, not an empty page (punch list #381)',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'View as from a person’s Task Mode window now lands on that person’s Today. For a crew person it landed on an empty Checklist page.',
    'Exit still brings the dev back to Review.',
    'A role with no Review or Manage tab that opens a link to one now sees Today.',
  ],
}

export default note
