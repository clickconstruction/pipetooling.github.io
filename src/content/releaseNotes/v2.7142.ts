import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7142',
  date: '2026-11-13',
  title: 'A text when a charge posts to your card, with the link that photographs the receipt. It ships switched off',
  kind: 'feature',
  highlights: [
    'Settings → Phone and texts has a new switch, Text a receipt link when a card charge posts. It is off until the owner or a dev turns it on, and it can be tried on your own card first.',
    'While it is on, a charge that posts to a card tied to a person texts that person a receipt link from the company number. Charges that post within one hour share one text.',
    'A charge still without a receipt gets one reminder in the evening. A charge from before the switch went on, or with its ticket already, gets no text.',
    'On the Team queue a charge says Texted and when, or No text and why: the card tied to no one, no cell on file, a person who has left, or a STOP.',
  ],
}

export default note
