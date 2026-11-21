import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8156',
  date: '2026-11-21',
  title: 'Papers before a job opens: a job’s paper built from settings gets its signing link',
  kind: 'fix',
  highlights: [
    'A job’s paper built from settings has no text of its own. Copy the signing link and Read and sign refused it as a paper with nothing to sign.',
    'Both now ask the job whether the paper carries settings, and hand out the link when it does.',
    'Every other paper is checked as before. No real job has a paper built from settings.',
  ],
}

export default note
