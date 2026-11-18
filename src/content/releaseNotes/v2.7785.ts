import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7785',
  date: '2026-11-18',
  title: 'Lien desk: a stop’s window takes you to what a copy is missing',
  kind: 'feature',
  highlights: [
    'Press a stop’s title on a job’s lien path and look at What went out. A recipient’s card that is missing something now has a press on that line, like Mail this copy, Enter the mail number or Add the receipt.',
    'The press closes the stop’s window and opens the place where that piece is entered. A filed lien that still owes its copies opens Filed liens: copies to mail at that job’s line. Anything else opens the job’s Lien window at that paper.',
    'The page scrolls to the spot and lights it for a moment, so you see where to work. The owner’s card says Enter the owner of record when the property record has no owner yet, and opens that record at the owner’s line.',
    'A card with its number and its receipt on file has no press. The press is for the office. Close the place you landed on and you are back on the job’s paper.',
  ],
}

export default note
