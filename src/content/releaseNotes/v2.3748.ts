import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3748',
  date: '2026-09-23',
  title: 'A job made from an estimate is named for the customer',
  kind: 'fix',
  highlights: [
    'Bringing an estimate over used to name the job after the estimate’s heading, so the Pipeline filled with jobs called “Estimate for Kimberly Coe”. Create job from estimate now seeds the job name with the customer’s name when the heading is still the one the app wrote.',
    'Jobs that Create jobs automatically makes at signature follow the same rule.',
    'A heading you typed yourself — “Second-floor rough-in” — still becomes the job name, and the Job name box stays yours to edit before you press Create.',
  ],
}

export default note
