import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8050',
  date: '2026-11-20',
  title: 'Job Mode: Materials on site sits beside Job calendar, with a count when the site has boxes',
  kind: 'feature',
  highlights: [
    'On the Job Mode card, Materials on site moved up beside Job calendar. The two are one row of presses under the job’s address, and the lone link in the middle of the card is gone.',
    'When the job’s site holds cages or boxes, the press shows how many. It counts the whole site, so cages kept under a sister job are counted too. The phone keeps the number, so it shows with no signal.',
    'The press opens the job the card names, before you clock in as well. On a day with no schedule the card shows no Materials press.',
  ],
}

export default note
