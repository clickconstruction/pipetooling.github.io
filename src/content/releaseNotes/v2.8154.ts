import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8154',
  date: '2026-11-20',
  title: 'Papers before a job opens: a job’s own settings are read, signed and kept',
  kind: 'feature',
  highlights: [
    'The sign page reads a job’s paper built from settings, in English or Spanish. It signs only the words it showed.',
    'The signed record shows the job’s settings when the paper was signed, in plain words. It says whether the seal of the words still holds.',
    'On a job, Add a paper shows a paper built from settings in grey. The page that sets a job’s settings is not built yet.',
    'No real job has such a paper, and every other paper works as before.',
  ],
}

export default note
