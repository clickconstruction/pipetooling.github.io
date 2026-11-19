import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7952',
  date: '2026-11-19',
  title: 'Projects board: a long job name is cut inside its card',
  kind: 'fix',
  highlights: [
    'On the Projects board, a card with a long job name drew the whole name on one line. The card ran past its own edge and over the card beside it.',
    'On a laptop the whole page then scrolled sideways.',
    'Now a long name ends in three dots inside its card. Press the name to open the card large, where the window shows the whole name.',
    'On a phone each card is as wide as the screen, so the page no longer moves sideways. The Projects line on the Dashboard opens to the same cards and has the same fix.',
  ],
}

export default note
