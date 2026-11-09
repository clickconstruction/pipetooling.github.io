import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6805',
  date: '2026-11-09',
  title: 'The ready to bill bar counts the jobs the Ready to Bill section shows',
  kind: 'fix',
  highlights: [
    'The orange bar read "2 ready to bill" while the Ready to Bill section held one job. The other was a test job a developer had left in that stage. The Pipeline hides test jobs from the office, and the bar counted it anyway. The bar now counts only the jobs the section lists.',
    'The Get contracts signed card had the same miss: its stage counts and its dollars included test jobs, so tapping "2 ready to bill" opened a list of one. The card, the contract lines in Needs you and the Day book now leave test jobs out.',
    'Nothing about a real job changed. A job in Ready to Bill is still counted until its bill is sent.',
  ],
}

export default note
