import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2933',
  date: '2026-09-06',
  title: 'The GC sees the stages you offer',
  kind: 'feature',
  highlights: [
    'A job-level switch under Edit Job → GC/Builder: "Share stage dates with this GC" — off by default on every job. Nothing about stages reaches their portal until it is on and you press Offer to GC on a stage.',
    'Jobs → Subs → Work gained a GC portal column: Offer to GC on a stage with a window, Shown · Withdraw once it is up. "Offer several together…" at the foot of a job puts two or more stages on one card with one window; withdrawing the bundle withdraws all of it.',
    'The GC portal shows a Stages card per job: the stage, the window or the sub\'s picked days, who (first name only), and how far along — planned, offered to a sub, scheduled, 50% along, inspection next, passed. Never money, paperwork or phone numbers.',
    'When a stage passes inspection, the dispatch inbox asks "offer the next stage to the GC?" — or, with the second switch on, the next stage is offered on its own.',
  ],
}

export default note
