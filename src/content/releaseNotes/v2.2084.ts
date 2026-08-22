import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2084',
  date: '2026-08-22',
  title: 'Search the Settings page',
  kind: 'feature',
  highlights: [
    'A search bar now sits above the Settings tabs — type what you\'re after and jump straight to it, even when it lives three clicks deep.',
    'Plain words work: "vacation" finds Personal time off, "trash" finds Recently deleted, "what\'s new" finds Release notes.',
    'Every result says where it lives ("in Your account →") before you tap, and you only see results your role can open.',
  ],
}

export default note
