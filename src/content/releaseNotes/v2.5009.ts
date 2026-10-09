import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5009',
  date: '2026-10-09',
  title: 'Dispatch: Esc, the week arrows and a cell’s + each end the right thing',
  kind: 'fix',
  highlights: [
    'Esc ends only what you are doing. Esc while moving a block no longer also drops a job you were placing.',
    'The week arrows end picking several cells at once, as they end a move or a copy.',
    'The add control in a cell ends a move, a copy or a pick before Add job to schedule opens.',
  ],
}

export default note
