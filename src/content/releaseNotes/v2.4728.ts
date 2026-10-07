import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4728',
  date: '2026-10-06',
  title: 'Won asks which option the GC took, and the bid room can sign any of them',
  kind: 'feature',
  highlights: [
    'When a letter carried two options, Edit Bid asks on Won: Which option did they take? Pick one and it becomes the active version, so the job, the takeoff and the labor follow it. The agreed value is that option\'s sent value plus any alternate they took. The other option is not marked lost. It just was not taken.',
    'The bid room now offers every combination the letter did: Option 1, Option 1 with its alternate, Option 2, Option 2 with its alternate. Whatever the GC signs is the option recorded on the bid, with its own value.',
    'A version flagged Alternate still appears in the room in place of Option 1, as before.',
  ],
}

export default note
