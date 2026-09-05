import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2816',
  date: '2026-09-05',
  title: 'Robots: scope verdicts can be amended, big plan sets get a staging door',
  kind: 'fix',
  highlights: [
    'A robot can now settle its scope verdict after it has seen the reference rows, instead of being forced to guess at the moment of unseal — two of the first four round-2 runs had their verdict recorded as unknown for that reason.',
    'Plan sets too big for CountTooling (over 50 MB or 200 pages) get a trim-and-stage path, so a takeoff is never finished with no sheet underneath it.',
    'Sign-in links from the harness come back as structured data rather than prose, and the round-2 kickoff tells parallel robots to keep separate work folders.',
  ],
}

export default note
