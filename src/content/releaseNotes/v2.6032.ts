import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6032',
  date: '2026-10-28',
  title: 'Subs: the run’s first text to a sub starts their Messages thread',
  kind: 'feature',
  highlights: [
    'Text them after a missed call in a run now works for a sub nobody has written to. The press starts their Messages thread from the number on their card and sends the text.',
    'The text goes to the person’s own cell when the card has one, else to the company’s line. The card’s note says when a text started the thread.',
    'A card with no number says so and what to do. A number that texted STOP holds with a call instead. The texting rule is unchanged: nothing goes until they said we may.',
  ],
}

export default note
