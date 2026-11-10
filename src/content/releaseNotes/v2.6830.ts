import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6830',
  date: '2026-11-10',
  title: 'Permits: skim one permit at a time, best first, with two answers',
  kind: 'feature',
  highlights: [
    'Prospects → Permits now opens on Skim. One permit shows at a time with what it is, where, who pulled it, the county’s owner of record and the miles from the office. The ones most likely to be ours come first, and a green line says why.',
    'Two answers: Keep or Pass. On a desk the right arrow keeps and the left arrow passes. Nothing is typed. A pass offers four one-tap reasons, and Undo takes an answer back for a few seconds before it is saved.',
    'The deck has no date window, so a permit stays until someone answers it. When none are left it says so, and Dig in opens the ones you kept.',
    'One set of words everywhere: Keep, Pass, Pursue and Has a plumber replace Look into it, Not for us, Approach them and Already taken on the ledger and the Decide sheet.',
  ],
}

export default note
