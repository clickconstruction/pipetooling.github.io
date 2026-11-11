import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6956',
  date: '2026-11-11',
  title: 'Your business card: a larger photo or larger words',
  kind: 'feature',
  highlights: [
    'Your card and footer now has a Card size row, under Business card. Pick Standard, Larger photo or Larger text. Each one is drawn with your own name and photo, in your look, before you pick.',
    'Larger photo grows the photo by a third. Larger text grows the words by a quarter, so a phone number prints near 11 point instead of 8. Both are larger than the standard card on both counts.',
    'A size changes the back of the card only. The front and the email footer stay as they are, and any size works in any look.',
    'The owner decides which sizes are offered, on Card and footer looks under Settings → People & teams. The office can pick a size for a teammate, and Cards and footers for the team prints each person in their own size.',
  ],
}

export default note
