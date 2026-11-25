import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8545',
  date: '2026-11-24',
  title: 'Bill Customer: on Test, the box no longer says the send is kept',
  kind: 'fix',
  highlights: [
    'With Stripe on Test, the box above the press said every send is kept in Bills sent. A test send is not.',
    'It now says Bills sent lists a test send as a test and keeps no copy, and that voiding the test bill takes the line off.',
    'On Live the box reads as before. The guide to Bills sent says the same of a test bill.',
  ],
}

export default note
