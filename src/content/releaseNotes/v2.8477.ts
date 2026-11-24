import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8477',
  date: '2026-11-24',
  title: 'Maps: an address the map cannot place is asked once, not on every open',
  kind: 'fix',
  highlights: [
    'When no map service can place an address, the app now remembers that. The Dashboard, Pipeline, Bid Board and Map page stop asking about it on every open, so those maps settle sooner.',
    'The app asks again by itself after 30 days. It also asks again as soon as someone changes the address.',
    'On the job form, Place it and Try again still ask the map services right away.',
    'A map service that is down or over its limit is not remembered, so a good address is never left off the map by an outage.',
  ],
}

export default note
