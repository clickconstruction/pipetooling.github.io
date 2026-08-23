import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2199',
  date: '2026-08-23',
  title: 'Vehicle check-ins: odometers plus "any lights on the dash?"',
  kind: 'feature',
  highlights: [
    "Quickfill's Vehicle odometers station is now Vehicle check-ins: assigned trucks come due weekly, motor-pool trucks monthly (walk out & check) — both cadences tunable by a dev from the Vehicles board's new ⚙ Check-ins settings.",
    'Each check-in asks the questions you configure — "Any lights on the dash?" out of the box. Check the box, say what you saw (required), and the answer files a Monitor-severity problem report on the vehicle automatically.',
    "Every check-in — including all-clear ones — lands on the vehicle's ledger with a new Check-ins filter, so you can see when each truck was last looked at and by whom.",
  ],
}

export default note
