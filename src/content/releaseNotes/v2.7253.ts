import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7253',
  date: '2026-11-14',
  title: 'Lien desk: a job paid in kind is treated as paid and is off the desk',
  kind: 'feature',
  highlights: [
    'A job on an open in kind arrangement is no longer on the Lien desk. It is on no tab, in no count or total, and in no notice run, print run or shared summary.',
    'Its Pipeline row carries no lien date, and the Dashboard no longer counts it. The desk has stopped watching its lien dates. The law\u2019s dates still run.',
    'The job\u2019s own Lien window still opens from the job. A line at the top says it is paid in kind. Every paper on file is still there.',
    'End the arrangement, or take the job off it, and the job is back on the desk the next time the desk opens.',
  ],
}

export default note
