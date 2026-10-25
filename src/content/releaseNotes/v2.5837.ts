import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5837',
  date: '2026-10-25',
  title: 'Quickfill: the Mark says what happened',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Every station bar used to offer one green press, Looked, whatever the count said. It now offers three. Done lights up when nothing is left. Worked it · N left is the honest press when rows remain, and it records the count. Not sure what to do opens one line, sends the station, its count and your words to the Dispatch inbox, and marks the station.',
    'The same three presses sit on the Roller, the phone round, the station header, Focus’s folded line and the foot of a station on the Page.',
    'The Mark history window shows a grey ? on a day you were not sure, and its habit line counts those looks. A question that is already in the Dispatch inbox is not filed twice.',
  ],
}

export default note
