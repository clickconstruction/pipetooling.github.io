import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4603',
  date: '2026-10-05',
  title: 'Bill Customer: the lien waiver window opens only when the tick was there',
  kind: 'fix',
  highlights: [
    'On a GC job, the Release of Lien window now opens after a send only when Send the lien waiver with this bill was on screen and left ticked.',
    'Before, Bill Customer opened on the job itself showed no tick, yet the waiver window still opened after the bill went. That bill now goes alone, and the waiver is added from the Bill tab.',
  ],
}

export default note
