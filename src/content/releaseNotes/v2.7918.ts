import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7918',
  date: '2026-11-19',
  title: 'Robots: an assistant can move a robot between read-only and its own bids',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now move a robot between the two rungs of its safety ladder, as Graduate and Back on the robot’s row in Settings → Digital twins do.',
    'Before anything changes it says which rung the robot stands on, which it would move to, and which machines’ keys gain or lose writes.',
    'The third rung, production, is not built, and an archived robot is left alone.',
    'Fixed: revoking the key of a robot that is working no longer fails because the key was used a moment ago.',
  ],
}

export default note
