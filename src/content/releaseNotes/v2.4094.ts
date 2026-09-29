import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4094',
  date: '2026-09-28',
  title: 'A field write-up\'s Dispatch request closes itself when the office sends the estimate',
  kind: 'feature',
  highlights: [
    'When the office sends a change order or estimate that came in as a field write-up, the Dispatch inbox request it arrived on closes on its own, marked "Sent to the customer" by whoever sent it.',
    'Until now the request sat open until someone pressed Dismiss.',
  ],
}

export default note
