import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6212',
  date: '2026-10-31',
  title: 'File a sworn statement’s signed copy: the scan on Evidence, the statement sworn on the Timeline (punch list #220, PR 5 of six)',
  kind: 'feature',
  highlights: [
    'Press File the signed copy… in the statement’s window or on its row. Drop the scan or the photo, confirm the day it is about, type the signing day off the jurat, say whether the paper reads as printed, and pick whose paper it is.',
    'The scan lands under Documents for the firm on the signing day with a line the desk writes for you. The Timeline’s line turns signed and reads Sworn Oct 29 before a notary in Guadalupe County.',
    'The two point at each other: Open the signed copy on the Timeline row, The statement on the Timeline in the scan’s ⋯ menu. The firm reads both on its portal.',
    'A paper changed by hand keeps the printed text and says the scan governs. A refused filing takes the scan back off Evidence, so nothing half-filed sits there.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
