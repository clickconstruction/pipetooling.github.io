import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5494',
  date: '2026-10-13',
  title: 'Messages: the email reader can read the team inbox too',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'Once the team inbox’s address is entered, the app reads it beside the bids inbox, each email onto its sender’s thread.',
    'Each line remembers which inbox it came to.',
    'Settings → Phone and texts shows how the team inbox is doing under the bids line.',
    'A problem with one inbox never stops the other.',
  ],
}

export default note
