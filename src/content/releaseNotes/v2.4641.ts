import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4641',
  date: '2026-10-05',
  title: 'Legal: one collections law firm at a time',
  kind: 'fix',
  highlights: [
    'The app now holds you to one active collections law firm, as the Legal desk guide already says. A second active firm cannot be saved.',
    'If two people save a firm at once in Settings, the second sees "One firm at a time" and a hint to reload.',
    'To change firms, retire the old one first. Its matters and history stay as they are.',
  ],
}

export default note
