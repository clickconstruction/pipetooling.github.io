import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7336',
  date: '2026-11-15',
  title: 'Pipeline: Collections reads whole in the stage bar, and the desk buttons stand off its edge',
  kind: 'fix',
  highlights: [
    'On Jobs → Pipeline the stage bar no longer cuts the word Collections, or the count under it, where the Lien desk button begins. Every stage name draws whole on a desktop and a tablet.',
    'The Lien desk and Legal desk buttons sit an even space apart, and the Legal desk button no longer touches the bar’s right edge.',
    'Each stage is now as wide as its words plus an even share of the room left over, so the bar reads the same from a wide screen down to a narrow window.',
  ],
}

export default note
