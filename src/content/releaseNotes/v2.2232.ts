import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2232',
  date: '2026-08-24',
  title: 'HR files: version history and a safer agent write path',
  kind: 'infra',
  highlights: [
    'Every rewrite of an HR summary or narrative now archives the previous version — nothing in the HR file can be lost, matching the append-only raw log.',
    'HR docs now record exactly which raw entries they cover, so the freshness dots reflect reality instead of guessing from timestamps.',
    'Entries and docs written by the HR agent are labeled as such, and the agent now writes through a single validated, least-privilege path.',
  ],
}

export default note
