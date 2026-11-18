import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7594',
  date: '2026-11-17',
  title: 'Lien desk: the draft footer moved into its own file',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. A draft still shows its state, why, and one press: the way to the gate that blocks it, Send for approval, or Sign and approve.',
    'This is the ninth cut of the Lien desk’s largest file. Every footer on the desk now lives outside it, with tests of its own.',
  ],
}

export default note
