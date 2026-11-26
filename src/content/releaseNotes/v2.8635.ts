import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8635',
  date: '2026-11-26',
  title: 'Add a part: Pick a different part sits under the part’s name',
  kind: 'fix',
  highlights: [
    'On the Add a part sheet, Pick a different part now sits right under the picked part’s name, above the number.',
    'Before, it was the last thing on the sheet, under the two Add presses, and on a phone with the number pad up it fell below the fold.',
    'The two Add presses stay where they were, so the last thing above the keys is one that adds the part.',
  ],
}

export default note
