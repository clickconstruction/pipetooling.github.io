import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6099',
  date: '2026-10-29',
  title: 'Offline in the field, part 2: the phone keeps a clock press and sends it later',
  kind: 'feature',
  highlights: [
    'Clock in or out with no signal and the press is kept on the phone with the moment you pressed it. It goes out on its own when the signal is back, and the phone tries again after 5, 10, 20 and 30 seconds, then every 30 seconds. Nothing you pressed is lost.',
    'The line at the top of every screen is the queue’s face. Amber while a press waits, with the count, the last try and a countdown, and a Try now. Green once it lands, like “Clock in from 7:58 AM sent ✓”, until you press Got it. Red when the office refuses one, with the reason and a Fix, or when a press has waited since yesterday. A tap on the line lists every press: what needs you, what waits, what was sent today.',
    'A clock press that reaches the office late is filed like a late entry: the stretch before it landed shows as typed by you and waits for approval like any typed hours, with a note on the session saying when it was pressed and when it reached the office. The clock itself reads “Clock in pressed at 7:58 AM · waiting to send” beside the timer, then “sent 8:11 AM ✓” for the rest of the day.',
    'A press sent twice counts once: every press carries its own id, and the office answers the first landing again. A payment, a bill, a card split, a text or an email to a customer, and a signature never wait on the phone.',
  ],
}

export default note
