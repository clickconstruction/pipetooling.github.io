import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8449',
  date: '2026-11-24',
  title: 'Document builder: the insurance row says how many jobs have a sheet',
  kind: 'feature',
  highlights: [
    'On Documents → Document builder, the row for Insurance requirements for subs now reads A sheet on 2 of 4 jobs.',
    'It counts the jobs you run as the GC, and of those the ones whose sheet is published. A draft is not counted, since no sub sees it.',
    'With no job to count, the row says so. If the jobs do not read, the row stays and gives the reason.',
  ],
}

export default note
