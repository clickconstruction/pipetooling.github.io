import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6874',
  date: '2026-11-10',
  title: 'The box label page says what ran out, and texts the office',
  kind: 'feature',
  highlights: [
    'On the page a box label opens, a part that ran out since the last count now stays on the list as None left. The next count clears it.',
    'A part the crew pressed Can’t find on says so on its line, such as 2 could not be found since the count.',
    'Text the office opens a text to the company number with the cage’s name already in it. The page still writes nothing to the app.',
    'A retired label now names the cage it came from.',
  ],
}

export default note
