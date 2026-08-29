import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2476',
  date: '2026-08-29',
  title: 'Bid room: publish change orders, single-packet outcomes, viewing telemetry',
  kind: 'fix',
  highlights: [
    'Publishing a change order into the bid room works now — the button was being (correctly) refused by a security rule and needed its own privileged path.',
    'Signing or declining in the room now marks single-packet bids Won or Lost too — before, only bids split into versions got their outcome written.',
    'A GC declining from the room records their reason on the bid itself for Why we lost.',
    '"Viewed option" tracking on estimate and proposal pages actually records now — a long-standing silent bug in the event logger meant those rows never landed.',
  ],
}

export default note
