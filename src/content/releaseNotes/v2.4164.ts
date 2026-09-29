import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4164',
  date: '2026-09-29',
  title: 'What the team sees: the Payment forecast digest renders live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees opens the Payment forecast digest on the sample company\'s bills — the bucket tiles, the pay-speeds line, past-expected first, a promise on the books — as the morning email lays it out. "Show the real one" stays underneath.',
    'The digest is unchanged: its renderer moved into a shared kernel the browser can run.',
    'Fourteen of the twenty-five team emails render live; eleven to go.',
  ],
}

export default note
