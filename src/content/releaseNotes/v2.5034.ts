import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5034',
  date: '2026-10-09',
  title: 'Robots: travel is $0.70 a mile, round trip, once per job day',
  kind: 'fix',
  roles: ['dev', 'estimator', 'master_technician'],
  highlights: [
    'The estimating robots now price travel at $0.70 a mile, both ways, for each day a crew drives out. A job 45 miles out that takes 12 days carries $756 of travel.',
    'This replaces the old $80 a mile and the 10% cap. That rate once put $23,464 of travel on a $49k job in Brownsville. Rentals are still priced by the estimator.',
  ],
}

export default note
