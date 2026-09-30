import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4230',
  date: '2026-09-30',
  title: 'Audits: the open card is the top of the queue, and one count of the robots’ questions',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Bids → Robots → Audits used to open on the oldest audit, far down the list, because it picked before the queue had loaded. It now waits for the queue and opens the top card — the one your verdict unblocks most — and keeps that card once you tap a row.',
    'The robots’ open questions are counted one way everywhere: the Audits panel, the Scoreboard’s Your part and the Dashboard card agree (the Scoreboard used to leave out questions not tied to a bid).',
    'The Dashboard’s Robot training card leads with the questions — “19 robot questions (about 15 min) and 31 audits are waiting on you” — since the questions are the fifteen-minute item.',
    'The coaching strip left the Audits tab; its facts live on the Scoreboard, where the recent runs are in the right order.',
  ],
}

export default note
