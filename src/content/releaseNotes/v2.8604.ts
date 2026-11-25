import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8604',
  date: '2026-11-25',
  title: 'Dashboard: the first bid shows you that it swipes',
  kind: 'feature',
  highlights: [
    'On a phone, the first bid on My Bids slides a little by itself when you scroll down to it. It shows Hide for a second and slides back, so you can see that a bid swipes. Nothing is hidden. Recent Reports does the same with Mark opened.',
    'It waits until the page is still and no finger is down, and a touch sends the bid straight back. It happens once a day at most and three times at most, and never again once you swipe a row yourself.',
    'The first bid in Hidden shows the way back the same way, to the right.',
    'If your phone is set to reduce motion, nothing moves. The card writes how to swipe under its heading for that visit.',
  ],
}

export default note
