import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8215',
  date: '2026-11-21',
  title: 'Bid photos: a bid’s photos show on the job after the win, and on Documents → Photos',
  kind: 'feature',
  highlights: [
    'A job won from a bid now shows the bid’s photos in its Job photos window. Each one reads From the bid, and the line under the grid counts them.',
    'Documents → Photos lists a bid’s photos too, under a new Bid photos chip. The row names the bid where a job would be, and Open the bid goes to it on the Bid Board.',
    'You see a bid’s photos only when you can open that bid: the office and the estimator, and a primary on their own bids. A crew member sees the job’s own photos, as before.',
    'A bid’s photo is looked at on the job and changed on the bid. Nothing moves in Drive.',
  ],
}

export default note
