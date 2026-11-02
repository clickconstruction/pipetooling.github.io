import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6322',
  date: '2026-11-01',
  title: 'The Job Mode clocking guide says what a punch with no signal does',
  kind: 'fix',
  roles: ['dev', 'subcontractor', 'helpers', 'superintendent', 'master_technician'],
  highlights: [
    'The guide clock in and out with Job Mode used to say a punch with no signal showed No connection with Retry, and that nothing was recorded until you tapped it. Its When you have no signal section now says what the app does: the phone keeps the press with the moment you pressed it, the line at the top shows it waiting, and it goes out on its own when the signal is back.',
    'The basement example and the clock-out sentence match, and the section links keep working when the signal drops for the line, the list behind it and what needs a signal.',
  ],
}

export default note
