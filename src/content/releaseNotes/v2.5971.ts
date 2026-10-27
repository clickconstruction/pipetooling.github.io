import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5971',
  date: '2026-10-27',
  title: 'The search box keeps a Settings card in view, and puts the guide you meant first',
  kind: 'fix',
  highlights: [
    'A Settings card opened from the search box, a Dashboard banner or a link now stays in view while the cards above it load. Before, it could end up below the screen.',
    'The search box ranks a guide by its own title and keywords. A guide’s category no longer counts, so office hours lists the guides about office hours first.',
    'Words typed as one phrase put the page, card or guide that holds the whole phrase first.',
  ],
}

export default note
