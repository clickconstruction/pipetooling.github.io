import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3971',
  date: '2026-09-27',
  title: 'GC statements: the Pipeline cards are for the whole office',
  kind: 'feature',
  highlights: [
    'The Pipeline’s “Statements to send” card now counts every GC that is checked and waiting, whoever its account man is, and shows to everyone in the office. Before, it showed only to the GC’s assigned sender.',
    'The card says how many of those GCs broke a pay-by promise. Both statement cards open GC Review on the week’s list.',
    'The one-at-a-time Start round walk-through is retired; the week’s list and the call sheet do its job. A link to one GC now opens that GC’s call sheet.',
  ],
}

export default note
