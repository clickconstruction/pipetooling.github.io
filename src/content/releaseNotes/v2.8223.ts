import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8223',
  date: '2026-11-21',
  title: 'Job window on a phone: the Note box is whole above the keyboard, it tags, and the Activity box is one box',
  kind: 'fix',
  highlights: [
    'On a phone, Note at the bottom of a job’s window opens its box whole: the box and Save sit above the keyboard. Before, the bar with Ready to bill and Arrived was drawn over the box, and Save was hidden. The bar is now put away while Note, Status or the ⋯ list is open.',
    'That Note box tags a teammate, as the Activity box does. Type @ or press the @ button, press a name in the row above the box, and Save. The name is shaded, it shows after Will tag, and one Backspace takes it off.',
    'On a phone the Activity section’s note box is one box, not four inside each other, and it runs the card’s full width: 320 px wide on a small phone where it was 273. Its words are larger and its hint reads Type a note….',
    'On a phone every press at the note box is a thumb tall: Note, Text, Email, Set % complete, @ and Post note. A desk is as it was.',
  ],
}

export default note
