import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7152',
  date: '2026-11-13',
  title: 'A card charge shows its receipt on Banking and Job Summary, and the card holder has a guide for the text',
  kind: 'feature',
  highlights: [
    'On Banking, the ledger and User Sort show a chip beside a recent card charge: Ticket or Receipt from the link when the paper is in, Texted and when, or No text.',
    'On Job Summary, a cost cell’s list of card charges has a Receipt column with the same chip.',
    'Rest the pointer on a chip to read the reason, like who has no cell on file. Only charges from the last 60 days show one.',
    'New guide for the person who gets the text: answer the text about a charge on your card.',
  ],
}

export default note
