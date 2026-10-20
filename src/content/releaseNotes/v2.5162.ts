import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5162',
  date: '2026-10-10',
  title: 'GC mode: a trade partner reads its pay applications and its closeout in its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner sees where its pay application stands under its report, and opens one it sent to read both pages of the form.',
    'A pay application we send back shows our note and the lines we doubt in its portal.',
    'Once every line is billed, it sees its closeout steps. For now it emails its pay application to us.',
    'Its portal home lists what needs it, each opening the job where it is.',
  ],
}

export default note
