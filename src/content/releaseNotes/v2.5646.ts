import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5646',
  date: '2026-10-19',
  title: 'The estimator who sold a job can write down the customer’s word on paying',
  kind: 'feature',
  highlights: [
    'A job’s people are the office, the job’s account manager, and the estimator or account manager of the bid it came from. They can record and clear the customer’s promised pay date on that job and read the job’s promises.',
    'A job opened from a won bid now carries the bid’s account manager, or its estimator, as the job’s account manager, on the team. Untick them in the New Job form if that is not right.',
    'The screens the estimator uses for this come in the next releases. For now the sheet on the Pipeline and the job’s activity feed read the job’s own promises.',
  ],
}

export default note
