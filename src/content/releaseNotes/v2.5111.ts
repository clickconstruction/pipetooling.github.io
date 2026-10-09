import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5111',
  date: '2026-10-09',
  title: 'Bid room: a signed room still names the alternate the GC took',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a GC signed a bid room with an add-on and opened the link again later, the signed line dropped the add-on’s name. The total still counted it.',
    'The line now reads the signature as it was saved, so it names every add-on taken, for example “To Plans” with Alternate 1 — Break room.',
  ],
}

export default note
