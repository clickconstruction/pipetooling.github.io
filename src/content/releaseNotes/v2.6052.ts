import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6052',
  date: '2026-10-29',
  title: 'Ask the estimators or Dispatch from a job’s or a bid’s window, and read its questions there',
  kind: 'feature',
  highlights: [
    'A job’s window and a bid’s window now carry Questions on this job and Questions on this bid: every question asked about the record, the open ones first with how long each has waited, then the answered ones with the answer’s words.',
    'Ask the estimators and Ask Dispatch sit on that section. The sheet opens with the record already picked and the lane chosen, so a question starts from where you are.',
    'A question asked on the bid a job came from shows on the job too, marked asked on that bid.',
    'The inbox row names the job or the bid, and the Development page lists the question under Questions, as before.',
  ],
}

export default note
