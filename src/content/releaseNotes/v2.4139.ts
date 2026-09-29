import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4139',
  date: '2026-09-29',
  title: 'Delete job → Reassign to another job works when both jobs came from estimates',
  kind: 'fix',
  highlights: [
    'Reassigning a job\'s costs to another job (and Combine on the Pipeline) failed with a red "duplicate key" error whenever both jobs had been made from estimates. The move now goes through.',
    'A job can carry one estimate. When the target already has its own, the deleted job\'s estimate stays on the Estimates page on its own instead of moving over — the success message says so.',
  ],
}

export default note
