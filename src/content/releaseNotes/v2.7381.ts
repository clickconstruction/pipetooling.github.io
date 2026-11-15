import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7381',
  date: '2026-11-15',
  title: 'Lien desk: point at a job on the Board to see which job it is before you press',
  kind: 'feature',
  highlights: [
    'On the Lien desk’s Board a chip is only a job’s number. Point at one and a card opens beside it with the job’s name, its address and its customer. It names the GC when the GC is not the customer.',
    'The card then says where the paper stands: the column and the bin, the one thing to know, its day and how long is left, whether it will make that day, and what the job still owes.',
    'A job with a second paper on the Board says where that one stands too. The last line says where a press will take you.',
    'Nothing is pressed by pointing. Move the pointer away and the card goes. The Tab key opens the same card. A phone shows none.',
  ],
}

export default note
