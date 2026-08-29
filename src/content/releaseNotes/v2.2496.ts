import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2496',
  date: '2026-08-29',
  title: 'Groundwork for emails to send from clicktooling.com',
  kind: 'infra',
  highlights: [
    'All app email now goes out through one configurable sender, so switching to the new clicktooling.com sending address is a single settings change.',
    'Nothing changes for recipients yet — mail keeps coming from the same address until the switch is flipped.',
  ],
}

export default note
