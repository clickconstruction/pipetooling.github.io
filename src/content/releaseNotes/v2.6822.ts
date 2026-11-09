import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6822',
  date: '2026-11-09',
  title: 'The dev seat leaves a note where the team reads it',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now leave one line on a job’s Job activity / notes, the thread the Pipeline row and the job window show, the way the Note press writes it, with the dev as its author.',
    'It can also leave a note on a bid: the bid’s own Notes on the Bid Board, or a note about one GC on the bid, which shows on that GC’s line and in the bid’s feed with their name.',
    'It plans first: the plan names the job or the bid as it reads, shows the latest lines already there and the row as it will land, then applies. A line that lands in between asks for a new plan.',
    'It tells nobody: no email, text or push goes out. The customer’s own thread stays the job window’s Note · Text · Email.',
  ],
}

export default note
