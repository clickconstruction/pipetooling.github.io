import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5064',
  date: '2026-10-09',
  title: 'Help: “stage a takeoff for a schedule of values” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
  highlights: [
    'The guide now opens with what to do first: every fixture on Bids → Takeoffs carries a stage, and you set it with its three boxes, then print the schedule or put it in the cover letter.',
    'Putting a schedule of values in the cover letter is now a guide of its own: the pill, labor and material, By stage or My lines, scaling to the contract, and the payment schedule’s stage shares.',
    'Nothing in the app changes, and no sentence was cut. Each part moved whole.',
  ],
}

export default note
