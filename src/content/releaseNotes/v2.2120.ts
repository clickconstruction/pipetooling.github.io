import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2120',
  date: '2026-08-23',
  title: 'Share, Print, and CSV use the customer\'s ★ price',
  kind: 'fix',
  highlights: [
    'Share, Print, and CSV on the Pricing Workbench now default to the ★ customer-facing scenario — not whichever card you last clicked.',
    'Viewing a different scenario? You get one question first: send the customer\'s ★ price, or the one you\'re viewing (for a teammate to check). The view never switches.',
    'The structure bar and tour now say it and mean it: the ★ is what the customer sees — Cover Letter, Share, Print, and the bid value all use it.',
  ],
}

export default note
