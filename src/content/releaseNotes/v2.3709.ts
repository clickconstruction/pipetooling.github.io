import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3709',
  date: '2026-09-22',
  title: 'Contract sweep: one look in Drive for the whole office',
  kind: 'feature',
  highlights: [
    'The sweep’s look through the jobs Drive used to run again for every person and every reload — a minute of “checking Drive…” each time. Now one reading is kept for the office: after the first open of the hour, everyone’s sweep has its Drive finds at once.',
    'The reading itself is faster: the folder walk that took most of the minute now looks at eight files at a time and never asks Drive about the same folder twice.',
    'The ⋯ menu’s Look in Drive item says how long ago Drive was read, and its window offers “read it again” for right after paper was filed or moved — instead of silently running its own minute-long scan as it did before.',
  ],
}

export default note
