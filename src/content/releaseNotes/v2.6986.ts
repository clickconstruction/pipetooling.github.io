import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6986',
  date: '2026-11-12',
  title: 'A dev’s agent can read counsel-only records on an HR file',
  kind: 'feature',
  highlights: [
    'An agent working through the dev seat now reads counsel-only evidence, its files and counsel-only papers on a matter, the way a dev signed in already could.',
    'What it reads is still marked counsel-only, so the agent knows to keep it out of open notes and documents.',
    'Nothing else opens: a counsel-only record is still never filed in Drive, the firm still sees a counsel-only paper with a lock and the printed packet still leaves it out.',
    'This is for now. Closing it again is one small change, and the agent’s replies say plainly if anything is still held back.',
  ],
}

export default note
