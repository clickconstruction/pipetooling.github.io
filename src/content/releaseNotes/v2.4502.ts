import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4502',
  date: '2026-10-04',
  title: 'AIA G702-G703: the lines come from the bid’s schedule of values',
  kind: 'feature',
  highlights: [
    'A job that came from a bid starts its first pay application with the bid’s schedule of values. A bid left on the three stages brings Rough In, Top Out and Trim Set.',
    'A line that belongs to a stage shows what the crew reported, with one button to use that percent.',
    'When the bid prints labor and material apart, the application starts that way too, two rows per line.',
    'When the lines do not add to the contract, the form says by how much and offers to scale every line to it.',
  ],
}

export default note
