import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6391',
  date: '2026-11-02',
  title: 'A stage nobody has reported no longer drags the job toward 0 on a field report',
  kind: 'fix',
  highlights: [
    'On a job with stages, a stage nobody has reported now counts from the job’s own percent, less what the reported stages already cover, instead of as 0. A job the office set to 100% stays at 100% when the crew marks one stage done.',
    'Only the stages the crew moves change the job’s number. Job 804, billed in full and set to 100%, read “job 100% → 40%” when Rough In was marked done. Under this rule it reads “job 100% → 100%”.',
    'Under how? on the report, such a stage reads “counts as 100%” so the points are visible. The row itself still reads not started until someone moves it.',
    'A fresh job whose 40% came from Rough In being done is unchanged: the other stages still count as 0 there, since the 40% is already Rough In’s.',
  ],
}

export default note
