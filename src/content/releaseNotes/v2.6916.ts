import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6916',
  date: '2026-11-10',
  title: 'A price sheet puts its fixtures on the takeoff',
  kind: 'feature',
  highlights: [
    'Once a fixture’s rows are filed, the sheet offers to place it. One press puts the fixture on the takeoff at the supply house’s price each.',
    'It reuses an assembly that already holds the same parts. It makes a new one only when none does.',
    'A fixture you costed by hand is never overwritten. The sheet says what it holds and waits for your press.',
    'A ready fixture is also offered on its own takeoff row while the sheet is open. Take off undoes a placement.',
  ],
}

export default note
