import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4718',
  date: '2026-10-07',
  title: 'Lien desk: the four gates read as rows, and fold when the notice is ready',
  kind: 'feature',
  highlights: [
    'Under Ready to go out, each gate’s section is now a row: the number, the title as a column, the fact with its buttons at the right on the first line, and one short grey line under it. Nothing blurs into the next gate.',
    'On a job where all four are clear the rows fold away, since the four cards already say every answer. Press a card to open its row, or Details to open them all. A gate that is not clear opens on its own, in red.',
    'Property kind is one line, Residential · Bexar County, with Change. Change opens the two choices and says what the other kind does to the dates. Switching takes two clicks on purpose, because every deadline on the job moves with it.',
  ],
}

export default note
