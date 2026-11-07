import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6606',
  date: '2026-11-06',
  title: 'Your week, said once after the week’s last clock-out',
  kind: 'feature',
  roles: ['primary', 'helpers', 'superintendent', 'master_technician'],
  highlights: [
    'After your last clock-out of the week, a sheet says the week once: when you clocked out and your hours this week, your signal and where it stands, how far it moved, and the customer’s words if a customer wrote some. One press: Have a good weekend.',
    'The app knows it is the last clock-out when nothing is on your schedule for the rest of the week. With no schedule at all, it is Friday’s clock-out.',
    'It skips a day the crew review deck deals, and it deals once a week. Nothing shows until the office has picked your signal.',
  ],
}

export default note
