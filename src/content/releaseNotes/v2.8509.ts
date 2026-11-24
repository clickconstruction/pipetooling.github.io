import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8509',
  date: '2026-11-24',
  title: 'Lien desk: a gate a tap lands on no longer keeps a blue ring in Safari',
  kind: 'fix',
  highlights: [
    'On an iPhone or in Safari, the first press on a held row of the Lien affidavits list left a blue ring and underlined words on the gate it landed on. They stayed after the amber light had gone. The gate now shows the amber light alone.',
    'Press Enter on a held row and the gate still shows the ring, since the keyboard is the one working. The ring also comes back as soon as a key is pressed on the gate.',
  ],
}

export default note
