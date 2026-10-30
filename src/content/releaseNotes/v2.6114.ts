import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6114',
  date: '2026-10-29',
  title: 'Job Parts Tally: the Choose job sheet finds a job and leads with the jobs you were on',
  kind: 'feature',
  highlights: [
    'The Choose job sheet on the Materials Estimate and On site tabs opens with a search on top. Type a number with or without its letter, a name, an address or a customer, and every section narrows. What you typed lights up on each row where it landed.',
    'Under the search, Recent lists the last three jobs you clocked in on, newest first, each saying when. Show N more unfolds to the last ten. With no clock-ins, the jobs your card purchases were last sorted to stand in, and each row says so.',
    'A number you type puts that job first, then the ones whose number starts with it. A hit on the customer shows the customer line. Nothing matching says so and offers Clear the search.',
    'The search is not focused when the sheet opens, so the keyboard stays down until you tap it. Once you do, the sheet keeps above the keyboard.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'dev', 'assistant', 'controller', 'estimator'],
}

export default note
