import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8068',
  date: '2026-11-20',
  title: 'Painted maps: Put the dot where I am says why under the press when your phone gives no reading',
  kind: 'fix',
  highlights: [
    'When your phone does not answer in time, or location is off, the reason now shows right under Put the dot where I am. Before, it showed at the top of the panel, out of sight.',
    'The words are the place panel’s own. They say the dot was not moved, and to drag the dot or press again. They no longer say to drag the map, which places nothing there.',
    'The reason takes the place of an older reading’s line, so the press is never seen to answer with a reading from two presses ago.',
  ],
}

export default note
