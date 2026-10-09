import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4972',
  date: '2026-10-08',
  title: 'A GC job’s billing job never shows where crews pick a job',
  kind: 'feature',
  highlights: [
    'A job that only carries bills stays off the dispatch board, Job Tally’s job list, the map, the follow-up queue and Pipeline’s Working column. Its bills still show under Ready to Bill and Billed.',
    'The office’s searches still find it: the header search, Mercury allocations, a bank line’s job search, Move payment and the paid-in-full email settings.',
    'The General contracting service type stays out of the service type pickers for jobs, bids, materials and supply houses.',
  ],
}

export default note
