import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2875',
  date: '2026-09-05',
  title: 'Did the customer ever look? The portal globe now says — and Usage shows real numbers',
  kind: 'fix',
  highlights: [
    'The customer portal globe\'s gear gains an Opened row — "Opened 3 times · last Sep 3" or "Not opened yet" — counting customer opens only.',
    'Office previews no longer count as customer views: the globe\'s live preview, Preview as customer, Full screen, and any open from a signed-in staff browser are skipped on the customer portal, the sub portal, and the bid room (an estimator checking their own room link no longer shows as the GC "opened 1×").',
    'Settings → Usage was showing "Nothing recorded" on every panel while the data was there — a double unwrap in the loader. It now shows the real page minutes, nav clicks, customer views, and per-person figures.',
  ],
}

export default note
