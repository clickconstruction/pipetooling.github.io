import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6699',
  date: '2026-11-08',
  title: 'The To chip: pick the number a text goes to, and remember it',
  kind: 'feature',
  highlights: [
    'The send window’s To line now shows a chip with the number the text goes to. A customer with one number sees a plain label and nothing changes. With two or more, the chip opens a short menu: each number with when it last carried a line, a number that sent STOP marked and not pickable, the office’s usual starred. Press one and the text goes there this once.',
    'The menu ends with a tick, Make this their usual number, on by default. Leave it on and the pick is remembered: every text after goes to that number first, and the thread shows a gray line like “Rosa made (830) 555-0190 Dana’s usual number.” Turn it off and the pick is for this text alone.',
    'One rule everywhere: the usual, else the number the thread last carried a line on, else the first that can still take a text. The reply box, the send window and the morning run’s reminders all read it, so a customer who texted from a second phone is answered on that phone, not the landline they gave at the first visit.',
    'Who is this? asks too. When the office names a new number for a customer who already has one, the sheet offers Make this their usual number with the old number beside it, ticked when the old number has been quiet a month.',
  ],
}

export default note
