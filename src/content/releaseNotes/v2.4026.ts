import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4026',
  date: '2026-09-28',
  title: 'Bids page smoke: a click waits for the page’s first load',
  kind: 'fix',
  highlights: [
    'One of the Bids page tests clicked a tab before the page had finished loading and failed once in a while. It waits for the load now. Nothing you see changed.',
  ],
}

export default note
