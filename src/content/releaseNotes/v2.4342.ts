import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4342',
  date: '2026-10-01',
  title: 'Pipeline: the contract chip says when the contract is due',
  kind: 'feature',
  highlights: [
    'Before a job is billed, the chip turns amber when a crew is booked: Contract by Sat Oct 3 · 2d. Once the crew has started it reads No contract · crew on site.',
    'With no crew booked, or no price on the job yet, it stays a grey No contract.',
    'A job billed to a GC reads No subcontract on file. Tap it to file their signed subcontract once and tick every job it names.',
    'Paid in Full rows show no contract chip, and the phone board only asks in the two amber cases.',
  ],
}

export default note
