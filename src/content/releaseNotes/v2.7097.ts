import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7097',
  date: '2026-11-12',
  title: 'Bid photos: a photo taken with no signal waits on the phone and sends itself',
  kind: 'feature',
  highlights: [
    'A photo taken on a bid with no signal is kept on the phone. Its tile reads Kept on this phone. Press the blue button and the photo goes to the bid when the signal is back.',
    'The bid’s Files window says how many of its photos still wait on the phone. The line at the top of the screen counts them too, as Bid photos waiting to send.',
    'A bid’s photos opened with no signal still offer Take a photo. Before, the window showed only that it could not load.',
    'A waiting photo is sent once. It survives a closed tab, and it goes out the next time the app is open with a signal.',
  ],
}

export default note
