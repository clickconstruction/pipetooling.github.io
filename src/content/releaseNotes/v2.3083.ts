import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3083',
  date: '2026-09-08',
  title: 'Stage Plan groundwork: a line item can now be a stage',
  kind: 'infra',
  highlights: [
    'Every job line item now carries a stage kind — in order, any time, or a plain line — and whether the GC sees it. Nothing changes on screen yet; the Bill tab selector, the Edit read-out, and the simpler GC card follow in the next releases.',
    'Every existing line item reads as "any time"; nobody\'s job is put in order until someone flips its rows to Order.',
  ],
}

export default note
