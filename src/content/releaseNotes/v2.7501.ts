import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7501',
  date: '2026-11-16',
  title: 'Plan sets: a sheet count on a set, and sheets in hand on the plans by date',
  kind: 'feature',
  highlights: [
    'A set of drawings can now carry how many sheets it has. Type it in the Sheets box when you add a set.',
    'On a development’s Plans, By date shows the count on a set’s card, with Set the sheet count or Change the sheet count.',
    'A fifth figure, Sheets in hand, adds the sheets of the sets each part builds from. Under it sits what was in hand the day the bid was sent.',
    'The figure appears once someone has counted a set, and it says how many sets are still not counted.',
  ],
}

export default note
