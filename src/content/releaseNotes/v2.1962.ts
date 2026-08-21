import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1962',
  date: '2026-08-21',
  title: 'Roadmap picker tidied; archived members get their names back',
  kind: 'fix',
  highlights: [
    '"New roadmap" moved inside the roadmap dropdown ("＋ New roadmap…" at the bottom), and the dropdown is only as wide as its longest entry.',
    'The Members dialog now shows archived people by name with an "(archived)" tag instead of a raw ID string.',
  ],
}

export default note
