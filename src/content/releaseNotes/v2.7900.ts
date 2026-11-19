import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7900',
  date: '2026-11-19',
  title: 'Robots: an assistant can list a robot’s keys and revoke one',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now list every robot’s keys, as Settings → Digital twins lists them.',
    'It can revoke a key by its label or its id, as Revoke on the robot’s row does. The machine holding that key is cut off at its next call.',
    'A key itself is never shown, only its label, its dates and whether it is live.',
    'There is no undo. A new key is made the usual way.',
  ],
}

export default note
