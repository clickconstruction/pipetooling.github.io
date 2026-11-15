import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7318',
  date: '2026-11-15',
  title: 'Lien desk: the scrolled strip says less, and every chip on it is a press',
  kind: 'feature',
  highlights: [
    'Once a notice scrolls past its gates, the strip pinned at the top now says only what you cannot see from there. A gate that blocks the send is one red chip in its own words, like Owner of record missing ›, with no separate Can’t go out yet beside it. With nothing blocking, one green Ready to go out › stands in their place.',
    'Every chip is a press. The owner chip opens the property record at the owner, the GC chip opens the job, the kind chip brings up its gate with the switch, the months and the claim chips go to their sections, and Ready to go out › goes down to the send. Show gates ▴ still takes you back to the top.',
    'The next step on the path shows on the strip only when it adds something the red chips do not already say. Find the owner, then send the Sep notice no longer repeats the owner chip under it.',
    'A sent notice’s grey Sent Oct 14 chip stays, and now takes you back up to the day it went.',
  ],
}

export default note
