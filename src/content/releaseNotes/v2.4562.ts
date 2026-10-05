import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4562',
  date: '2026-10-05',
  title: 'Lien cards and steps open the job\'s Lien window',
  kind: 'fix',
  highlights: [
    'The Dashboard card for a filed lien that has not been served now opens that job\'s Lien window on the Mechanic\'s lien tab. Before, it opened the Pipeline with nothing open.',
    'The card for a demand letter past its deadline opens the job\'s Lien window on the demand letter.',
    'On What customers see, Open the Lien instruments now opens the Lien window. Before, it opened the job.',
    'With more than one job behind a card, the first one opens. The others are on the Lien desk.',
  ],
}

export default note
