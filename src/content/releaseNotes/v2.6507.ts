import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6507',
  date: '2026-11-04',
  title: 'A band on each New row on Messages says which desk finishes it, Dispatch or Estimating',
  kind: 'feature',
  highlights: [
    'Each row in New on Messages → Follow up carries a narrow band on its left edge in the color of the desk that finishes the work: steel blue with the bell for Dispatch, violet with the pencil and ruler for Estimating, the header’s own colors and icons.',
    'An invitation to bid, a trade partner and an architect read as Estimating. A customer on a Pipeline job, or writing on the team number, reads as Dispatch. A customer whose only job is a bid, or who wrote to bids@, reads as Estimating.',
    'A row the app cannot place yet, such as a sender nobody has named, has no band. Hover a band to read why it is there. The band is not a press and changes nothing about who has the row.',
  ],
  roles: ['dev', 'assistant', 'controller', 'estimator', 'master_technician'],
}

export default note
