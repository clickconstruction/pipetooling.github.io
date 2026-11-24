import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8472',
  date: '2026-11-24',
  title: 'Lien desk: a held affidavit row opens on the gate that holds it',
  kind: 'feature',
  highlights: [
    'Press a row on the Lien affidavits list that shows a red cross. The pane now opens with that gate on the screen, lit for a moment, so the next press opens the record that clears it.',
    'With more than one red cross, the pane shows the first, in the order of the row’s marks. A gate already on the screen is lit and nothing scrolls.',
    'A row with every gate clear opens at the top of its pane, as it always did. If you asked your device for less motion, the pane jumps with no glide.',
  ],
}

export default note
