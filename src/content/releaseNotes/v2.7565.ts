import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7565',
  date: '2026-11-17',
  title: 'Lien desk: a record on a mailed notice no longer makes its signature read as gone',
  kind: 'fix',
  highlights: [
    'A mailed notice keeps its signature when the desk writes a record on it: what they promised, the owner’s call, the GC’s okay or a courtesy notice.',
    'Until now each of those records made the notice read as unsigned. No screen showed a mailed notice’s signature yet, so nobody saw it.',
    'Any change to the paper itself still takes the signature off, as before, and the leader signs again.',
    'Every signature on the desk today reads exactly as it did.',
  ],
}

export default note
