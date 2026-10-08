import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4947',
  date: '2026-10-08',
  title: 'Where the checks went: bills list in number order',
  kind: 'fix',
  highlights: [
    'A check’s bills in Find a check, on the checks sheet and on the portal list in number order: Invoice 2 before Invoice 10.',
    'Jobs that tie in the checks sheet’s job table list the same way: 9 Cedar Ln before 10 Cedar Ln.',
  ],
}

export default note
