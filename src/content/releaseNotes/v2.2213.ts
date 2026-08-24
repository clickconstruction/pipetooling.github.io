import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2213',
  date: '2026-08-23',
  title: 'Cover letter: separate sheets, and no $0 bids on the letter',
  kind: 'feature',
  highlights: [
    'A bid with no prices yet never reaches the letter — it shows grayed in the checklist as "unpriced — left off the letter" and rejoins automatically the moment it\'s priced. Mark sent skips it too.',
    'The bundled preview now draws each bid as its own sheet — bordered, with a labeled header band — so it\'s obvious where one letter ends and the next begins. The printed and copied documents are unchanged.',
  ],
}

export default note
