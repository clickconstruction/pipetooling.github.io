import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2981',
  date: '2026-09-07',
  title: 'Team board: "Looks right", and your own ran-long threshold',
  kind: 'feature',
  highlights: [
    'A ran-long or clocked-not-planned chip you have looked at can be accepted with "Looks right". It turns green, leaves the exceptions list and the counts, and shows "✓ accepted" under the hours. "Undo accept" brings it back.',
    'How far past its dispatch block a day has to run before it counts as ran long is now a company default: Settings → Company → Defaults for everyone → "Ran long on the Team board" — gentle, standard (1.5× and 1.5 h over), loose, or off. Field and office roles can differ.',
    'The board\'s footer says which rule is in force and how many chips were accepted this week.',
  ],
}

export default note
