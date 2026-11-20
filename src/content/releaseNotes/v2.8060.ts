import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8060',
  date: '2026-11-20',
  title: 'Materials on site: three doors no longer send a primary, a superintendent or an estimator to a page that turns them away',
  kind: 'fix',
  highlights: [
    'In the search box, a box’s row now opens the box itself for a primary, a superintendent and an estimator. It used to open the office’s materials page, which sent them to Reports or to the Bid Board.',
    'On a job’s window, a primary’s Materials tab now reads Open Materials on site and opens the job’s boxes.',
    'On a bid’s Procure step, an estimator’s Materials on site link opens the job’s boxes.',
    'Nothing changes for the office. All three doors still open the materials page on the job.',
  ],
}

export default note
