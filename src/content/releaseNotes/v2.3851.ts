import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3851',
  date: '2026-09-26',
  title: 'Get contracts signed: the stage counts sit in two rows, never more',
  kind: 'fix',
  highlights: [
    'The 19 waiting · 24 working · 1 ready to bill · 50 billed · 7 collections counts on the Pipeline’s Get contracts signed card now sit in two aligned rows (three stages, then two) beside the headline, at every screen width — never a long single line that drops under the text as its own row and pushes Start the sweep to a third.',
    'Up to three stages stay on one row. Each count still opens the board filtered to that stage.',
  ],
}

export default note
