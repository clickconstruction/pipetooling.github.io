import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6754',
  date: '2026-11-08',
  title: 'Quickfill: the standing backlogs run oldest first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Prospects: inside Promised and missed, Past their days and On time, the prospect waiting longest comes first. A missed callback sorts by its promised day, the rest by the days since the last touch, a prospect never touched by the day it was added.',
    'Fill them in: the lost bids with no reason come oldest first, the bid marked lost longest ago on top, the day it went out standing in when the loss was never stamped. Before, the biggest value led.',
    'Billed Awaiting Payment already led with the oldest bill in each fold and keeps that order. None of the three offers a daily portion; Done lights at zero as on every station.',
  ],
}

export default note
