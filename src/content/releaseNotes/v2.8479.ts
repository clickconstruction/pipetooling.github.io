import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8479',
  date: '2026-11-24',
  title: 'Maps: the no map location line opens the list, with the reason and Try again',
  kind: 'feature',
  highlights: [
    'On the Dashboard and Pipeline maps, the office can click “N jobs have no map location yet”. It opens the Map page’s list of records the map cannot place.',
    'Each address the map could not find now shows the day it was last checked and the day the app will ask again by itself.',
    'Try again on a row asks the map services right away and says what they found.',
    'The Bid Board map keeps its own sheet, where a missing address is typed in place.',
  ],
}

export default note
