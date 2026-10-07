import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4674',
  date: '2026-10-06',
  title: 'Release of Lien: Issue unconditional selects every bill the conditional covered',
  kind: 'fix',
  highlights: [
    'When a conditional release covered more than one bill, Issue unconditional now opens the Release of Lien window with all of those bills selected, not only the first.',
    'The amount fills from the payments on all of them. This works from the Dashboard’s list and from Bill Customer.',
  ],
}

export default note
