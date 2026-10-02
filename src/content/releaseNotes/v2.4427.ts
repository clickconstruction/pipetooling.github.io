import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4427',
  date: '2026-10-02',
  title: 'Bids: a phone notification on the morning of a promised call',
  kind: 'feature',
  highlights: [
    'On the morning of a day you picked to call a GC again, the bid’s account manager gets one notification on their phone. With no account manager it goes to the estimator.',
    'It names the builder, the bid and who to ask for, and opens the Call queue.',
    'It is sent once. If the day passes with no call, the Dashboard card and the Call queue keep showing it.',
  ],
}

export default note
