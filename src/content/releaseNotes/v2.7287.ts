import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7287',
  date: '2026-11-14',
  title: 'Dark theme: fifteen more borders take the theme’s colours',
  kind: 'fix',
  highlights: [
    'A hairline that stayed light grey on the dark page now takes the theme’s colour: the picked note tab on a job thread, the drop targets on Banking’s drag sort and CSV import, the Only my bids toggle, a tech tree group, a vehicle task, a pay stub, the forecast’s inputs and a few more.',
    'The check that guards the colours now reads a colour written inside a template string, so a new one of these cannot slip in.',
  ],
}

export default note
