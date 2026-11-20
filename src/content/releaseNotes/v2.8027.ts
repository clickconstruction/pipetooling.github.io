import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8027',
  date: '2026-11-20',
  title: 'Lien desk: on a missed notice, a paper already on record can stand for a closed month',
  kind: 'fix',
  highlights: [
    'On a missed notice with no month still due, Record it… now offers the closed months to tick under a paper already on record. Before, it said the desk was not asking for a month, and Apply could only refuse.',
    'Pick the paper, tick the month it stood for, and Apply writes one record on this job. The month then reads as noticed.',
    'The checks are the same. A paper that went before the month began is refused. One that went after the month’s deadline reads as late and asks why.',
  ],
}

export default note
