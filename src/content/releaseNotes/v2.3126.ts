import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3126',
  date: '2026-09-07',
  title: 'Robot shadows score the moment you send',
  kind: 'feature',
  highlights: [
    'When a robot has sealed a blind number on one of your live bids, the scorecard now lands the instant you mark the bid sent with a value — no more waiting for the next robot run to grade it. The note appears on both bid ledgers exactly as before.',
    'The Dashboard Needs-you card now shows sealed robot numbers on live bids (blue, "Robot bid"): one line naming the bid, or a count when several are waiting. Nothing to do — it is the head start; Open Shadows takes you to the sealed-envelope view.',
  ],
}

export default note
