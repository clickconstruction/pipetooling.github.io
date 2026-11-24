import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8506',
  date: '2026-11-24',
  title: 'Papers before a job opens: the GC downloads a sample of the job’s paper',
  kind: 'feature',
  highlights: [
    'On the GC’s page, a job’s paper now has Download a sample. It is the paper for that job’s settings, as a signer reads it.',
    'The sample names a made-up job and signer, and SAMPLE is printed across each page. It is never for signing.',
    'Only the GC on that job can open it, through their own page.',
    'It shows after the update is switched on, and only a test job can take such a paper today.',
  ],
}

export default note
