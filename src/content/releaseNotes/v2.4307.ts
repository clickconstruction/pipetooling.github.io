import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4307',
  date: '2026-10-01',
  title: 'Edit Job → Bill: the money said once, and Make a bill',
  kind: 'feature',
  highlights: [
    'One money card says what is done, paid, billed and left to bill. Each line is a block with the % done marker across them, and a row saying where its money stands.',
    'Make a bill shows only while money is left. One button bills all of it. Bill part of it keeps the amount box and the slider.',
    'Tick lines on the card to bill them, or press Bill it on a stage that is ready.',
    'In order / Any time stays under each line. The stage note opens from How stages work.',
  ],
}

export default note
