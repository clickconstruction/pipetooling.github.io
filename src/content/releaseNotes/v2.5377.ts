import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5377',
  date: '2026-10-12',
  title: 'Two more server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code that puts a GC bill on card and the code that hands the robots a bid’s plan sets are checked cleanly by the server’s own type checker.',
    'Nothing either of them does changes.',
  ],
}

export default note
