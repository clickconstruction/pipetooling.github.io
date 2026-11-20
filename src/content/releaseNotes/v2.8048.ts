import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8048',
  date: '2026-11-20',
  title: 'Job pace: the superintendent’s card says what it compares, in hours',
  kind: 'feature',
  highlights: [
    'The red card on a superintendent’s Job Mode page has a name now, Job pace. It shows two bars on one scale, Hours used and Work done, and the striped end of the hours bar is the gap between them. The word points is gone.',
    'The card asks before it warns. When the crew has put in hours since the percent was last set, it turns amber and asks whether the percent is still right. Still 40% says the same number again today in one press. The card is red only when the percent is fresh and the hours are still ahead.',
    'The card speaks hours, never money. When money is ahead of the work but the hours are not, it stays calm and says the office watches that. What is this? explains the card, and opens by itself the first time. A stage marked done now shows its tick, where a first stage at 100% could read 98% and still in hand.',
    'For the office, the Projects board says Money is ahead of the work, and the Costs tab says how many dollars over the job is, the same way it already says dollars kept.',
  ],
}

export default note
