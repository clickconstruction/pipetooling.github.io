import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5370',
  date: '2026-10-12',
  title: 'Lien desk: the run shows where it stands, a journey across the top (run train, PR 2)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The run window opens with six steps across the top: Built, Signed, Sent, In the mail, Recorded, Delivered. Each one says how many envelopes have reached it, like 2 of 3.',
    'The step that blocks the run is drawn in amber on that step, with why: 2 wait on Robert. The fill between the steps runs as far as every envelope has come.',
    'The old step strip stays one release longer. Nothing else in the run moves yet.',
  ],
}

export default note
