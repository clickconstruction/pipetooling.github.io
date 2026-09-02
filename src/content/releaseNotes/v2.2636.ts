import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2636',
  date: '2026-09-02',
  title: 'The RFQ Desk: email price requests and watch them land',
  kind: 'feature',
  highlights: [
    'The Supply house list grows "Send by email…" — pick houses, and each gets its own email with the parts list in the body and its own quote link. You preview every email, exactly as it will send, before anything goes out.',
    'The new desk (the RFQs chip by Share) tracks each request as a trail — Sent → Delivered → Viewed → Quoted — with bounces in red and an inline fix-the-address-and-resend.',
    'One-tap nudges with a 24-hour cooldown, previewed before they send. A coverage bar answers the real question: which items does nobody have priced yet?',
    'Requests can be closed by hand now, and the compare view finally shows quantity-drift badges when counts changed since a request went out.',
  ],
}

export default note
