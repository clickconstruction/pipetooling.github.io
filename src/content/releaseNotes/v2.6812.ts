import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6812',
  date: '2026-11-09',
  title: 'The ground for a photo of the supply house ticket, taken at the counter',
  kind: 'infra',
  highlights: [
    'Nothing new shows on a screen yet. This is the first of four steps toward one press on Tally that takes a photo of a supply house ticket or a receipt.',
    'The app can now keep a ticket with its pages, the job it is for and the card charge it belongs to. A ticket is seen by the person who took it, the office and the holder of the card that paid.',
    'A ticket will be filed in the job’s Drive folder under Team only, in a folder named Tickets. It never lands in Customer Pictures, since a ticket shows prices.',
    'The rule that ties a ticket to its charge is written and tested: the only swipe on that person’s card in the half hour before the photo. Two swipes that fit are never guessed between.',
  ],
}

export default note
