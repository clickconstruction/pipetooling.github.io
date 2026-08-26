import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2372',
  date: '2026-08-26',
  title: 'Typing a workbench price overwrites the old one',
  kind: 'fix',
  highlights: [
    'Clicking or tabbing into a Sale price/unit box in the pricing workbench now selects the number that’s there, so what you type replaces it — no more digits gluing onto the old price.',
    'Esc still puts the old number back, and tabbing through a row without typing changes nothing.',
  ],
}

export default note
