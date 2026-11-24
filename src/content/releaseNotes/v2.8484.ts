import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8484',
  date: '2026-11-24',
  title: 'Maps: an unplaced address is now really remembered',
  kind: 'fix',
  highlights: [
    'The first live check of v2.8477 found that nothing was being remembered. One of the three map services was not answering, and the app was waiting for all three.',
    'An address is now remembered when Google and the US Census both say they cannot find it. The maps then stop asking about it on every open.',
    'When a map service does not answer, the reason on the Map page now says which one.',
  ],
}

export default note
