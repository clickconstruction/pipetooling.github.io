import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4304',
  date: '2026-10-01',
  title: 'Customer portal: lien waivers sit with the bills and the papers',
  kind: 'feature',
  highlights: [
    'A lien waiver shows on the account page once the leader has signed it. Each open bill gets one line in its note that opens the signed PDF.',
    'Agreements, lien waivers and test reports now share one Your papers card. Every row reads the same way and has one View button.',
    'The owner of a GC job sees our waivers on the bills the office shared with them, paid bills included.',
    'The waiver email ends with the same Your account, any time card the bill emails carry, when the GC has an account page.',
  ],
}

export default note
