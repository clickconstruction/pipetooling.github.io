import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4010',
  date: '2026-09-28',
  title: 'Job window: the Costs tab follows what you change on Bill',
  kind: 'fix',
  highlights: [
    'Change a price on the Bill tab and the Costs tab kept showing the old job total until you closed the job and opened it again. It now shows the new total at once.',
    'An “other job charge” you add on Costs counts as money spent right away, too.',
  ],
}

export default note
