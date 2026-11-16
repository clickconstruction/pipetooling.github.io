import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7441',
  date: '2026-11-16',
  title: 'Lien desk: a notice with a late month reads its open window, not window closed',
  kind: 'fix',
  highlights: [
    'A notice can name a month whose window has closed, next to months still open. Job 804 named July, August and September.',
    'Its row in the Monthly notices list read window closed, from July. August was due that very day.',
    'The row now goes by its soonest open month, so it reads due today. The closed month keeps its own chip, like Jul window closed.',
    'The Board, the sort order and the hold dates go by the same open month.',
  ],
}

export default note
