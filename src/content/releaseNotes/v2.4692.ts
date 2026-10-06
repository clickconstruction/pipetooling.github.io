import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4692',
  date: '2026-10-06',
  title: 'Needs you: vehicles missing insurance, registration or service',
  kind: 'feature',
  highlights: [
    'The Needs you card, on the Dashboard and on Quickfill, now lists each vehicle someone is driving that has no insurance, registration or service on file.',
    'It names the driver and what is missing. Open Vehicles takes you to People → Vehicles to add them.',
    'The owner, the assistant and the controller see it. A vehicle leaves the card once all three are entered.',
  ],
}

export default note
