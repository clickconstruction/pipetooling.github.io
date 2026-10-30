import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6141',
  date: '2026-10-30',
  title: 'Supply-house bills on a thread: Not a bill and Record this bill take the offer away',
  kind: 'fix',
  highlights: [
    'On a supply house’s thread in Messages, Not a bill now takes the offer away and drops the bill from the house’s count. Before, it was refused.',
    'A bill saved through Record this bill now leaves the thread too, with Recorded as a bill under the file.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
