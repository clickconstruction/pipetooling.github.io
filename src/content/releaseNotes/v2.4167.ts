import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4167',
  date: '2026-09-29',
  title: 'What the team sees: the Billed awaiting payment report renders live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees opens the Billed awaiting payment report on the sample company\'s bills — customers A to Z, each with their contact line, oldest bill first, the 30–90 and 90+ chips and the grand total — as the email lays it out. "Show the real one" stays underneath.',
    'The report is unchanged: its renderer moved into a shared kernel the browser can run.',
    'Fifteen of the twenty-five team emails render live and none is real-only now; ten digests to go.',
  ],
}

export default note
