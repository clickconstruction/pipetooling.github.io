import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7786',
  date: '2026-11-18',
  title: 'Checklist Review: a dev can View as the person from their Task Mode window (punch list #381)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The window that shows a person’s Task Mode has one new line for a dev, under What this look does not show.',
    'View as signs the dev in as that person, after a question. The app records it, and Exit brings the dev back.',
    'The owner’s window is unchanged. The line is not offered on a dev’s own row, for another dev, or for a person with no login.',
  ],
}

export default note
