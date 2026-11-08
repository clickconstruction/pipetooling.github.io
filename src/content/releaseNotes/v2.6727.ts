import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6727',
  date: '2026-11-08',
  title: 'Legal desk: the money bars draw for a claim typed onto a matter with no open bill',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A matter whose claim is typed lines alone, with no open bill, now draws the money bars and What each path nets under the four tiles. Before, they stayed hidden on such a matter.',
    'The bars’ sentence on such a matter reads Nothing open on the bills, then what the office typed onto the claim.',
  ],
}

export default note
