import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7139',
  date: '2026-11-13',
  title: 'Card and footer looks opens to the owner, and Settings search finds both card-and-footer cards',
  kind: 'fix',
  highlights: [
    'The owner now sees Card and footer looks on Settings → People & teams. Before, only a developer saw the card that offers a look or a card size to the team.',
    'The owner’s switches and defaults save. A save that is refused puts the switch back and says why.',
    'Settings search now finds Your card and footer and Card and footer looks, and lands on the card.',
    'Each of the two is offered only to the people who have that card.',
  ],
}

export default note
