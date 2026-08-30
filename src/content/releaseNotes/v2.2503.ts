import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2503',
  date: '2026-08-30',
  title: 'Robot takeoffs arrive with plans attached — and reviews can send them back',
  kind: 'feature',
  highlights: [
    'A twin-imported CountTooling takeoff now lands with the full plan set under the marks (fetched server-side from the bid\'s Drive file) — no more "Canvas only" robot projects.',
    'Reviewers can send a robot takeoff back with a note ("Request changes…" on the Bid Board review lane), and the twin sees the verdict and note in its work state.',
    'A new CountTooling guide teaches any agent the full plans → import → review → counts loop.',
  ],
}

export default note
