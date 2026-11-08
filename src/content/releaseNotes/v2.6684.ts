import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6684',
  date: '2026-11-08',
  title: 'The Your week card’s test no longer fails when the pay week rolls over',
  kind: 'fix',
  highlights: [
    'A test of the Dashboard’s Your week card used jobs from the week it was written, so it started failing the night the pay week rolled over and held every change in the queue. The test now pins its day inside that week. Nothing changes on screen.',
  ],
}

export default note
