import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6981',
  date: '2026-11-11',
  title: 'First look, to try: a link a caller opens with no sign-in to send photos and a video of the problem',
  kind: 'feature',
  highlights: [
    'A trial for the owner and the developers. On the First looks page, make a link, open it on a phone, and add photos and a short video. Nothing is sent to a customer from the app yet.',
    'The page keeps every file on the phone the moment it is picked. With no signal it says so and sends by itself when the signal is back, and a video picks up where it stopped.',
    'What comes in shows on the First looks page with each photo, the video in a player, and how each upload went: its size, whether it went in pieces, and which phone sent it.',
    'A link takes 20 photos and 3 videos for 7 days. A video can be up to 50 MB, about 20 to 40 seconds.',
  ],
}

export default note
