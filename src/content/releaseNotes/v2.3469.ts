import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3469',
  date: '2026-09-15',
  title: 'Lien desk: a “send without asking” rule starts with the second notice',
  kind: 'fix',
  highlights: [
    'The first § 53.056 notice to a GC always comes to the master, even when that GC’s standing rule says send without asking. The office proves the owner, the mailing addresses and the GC’s copy on real mail once; the rule takes over from the next month on.',
    'The desk says so: a GC on “send” with nothing recorded yet shows Send for approval, not Put it in the run, and the footer explains why. The rule picker’s hint reads the same.',
    'The database refuses a rule approval on a GC with no recorded notice, so nothing slips past by another door.',
  ],
}

export default note
