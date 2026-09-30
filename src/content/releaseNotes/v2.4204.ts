import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4204',
  date: '2026-09-30',
  title: 'Counts: quick add lands in a group',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Quick add has a Group box that offers the bid’s groups — an alternate reads “· ALT” — so a hand-counted row lands in its group instead of needing a second edit.',
    'In By group, every heading has its own “+ add here”, which opens quick add with that group filled in.',
    'A row is only called a duplicate within its own group, the same rule the sheet already used.',
  ],
}

export default note
