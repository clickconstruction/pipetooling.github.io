import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7521',
  date: '2026-11-16',
  title: 'Lien desk: a job taken off the lien path leaves every lien screen',
  kind: 'infra',
  highlights: [
    'The Lien desk now reads the answer kept on a job since v2.7504. A job a person took off the lien path leaves the Board, the lists, the run, By job, By date and the Dashboard’s lien counts together.',
    'It also leaves the Pipeline’s lien dates, the Materials page’s held line and the law firm’s lien grid.',
    'The job’s own Lien window stays whole. It says the job is off the lien path and gives the reason.',
    'Nothing can take a job off the path yet. The press that asks why, and the bin that lists these jobs, come next.',
  ],
}

export default note
