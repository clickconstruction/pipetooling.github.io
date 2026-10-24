import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5803',
  date: '2026-10-23',
  title: 'Call in Quo or from my phone: every Call button asks once on a phone and keeps your pick',
  kind: 'feature',
  highlights: [
    'On a phone, the first press of Call offers Call in Quo and Call from my phone when you have a seat on the Company phone seats card. The pick is kept on that phone, so the next press is one tap.',
    'Call in Quo opens the Quo app and dials from the company number, so the call lands in the thread and the call task closes on its own. A small ▾ beside Call changes the way at any time.',
    'On a computer, Call opens the computer’s calling app as before, and the ▾ shows the one-time steps that make Quo the default.',
    'Call back on a missed call or a voicemail is live. With no seat, Call dials from your phone as it always did.',
  ],
}

export default note
