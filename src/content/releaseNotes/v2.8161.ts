import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8161',
  date: '2026-11-21',
  title: 'Before we start: a No on arrival says where it was sent from',
  kind: 'fix',
  highlights: [
    'In the Dispatch inbox, the window of a No on arrival said the crew sent it from the sheet. No checklist sheet is behind that line.',
    'Its first line now reads sent on arrival. A check sent from a checklist still reads sent from the sheet.',
  ],
}

export default note
