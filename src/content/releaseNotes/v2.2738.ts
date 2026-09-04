import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2738',
  date: '2026-09-03',
  title: 'Pipeline shows which jobs still need a contract, stage by stage',
  kind: 'feature',
  highlights: [
    'Jobs → Pipeline opens with a "Get contracts signed" card: how many live jobs have no agreement on file and the dollars riding on them, with a chip per stage — tap Working 15 to see exactly those jobs, or Start the sweep to send them all.',
    'Paid jobs are out of scope; accepted estimates and bid-room signatures already count. When every live job is covered the card becomes one green line.',
    'In the Contract modal, Upload signed contract now sits in the top-right corner, apart from the send buttons, and opens its own small sheet.',
  ],
}

export default note
