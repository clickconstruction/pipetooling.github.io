import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3196',
  date: '2026-09-09',
  title: 'Cost batches: moving job cost is now recorded and reversible',
  kind: 'feature',
  highlights: [
    'When an agent or a dev moves cost between jobs — bank charges, supply-house invoices, clock sessions — it now happens as one named batch with a reason, and every row it touched keeps its before-image. One call puts it all back.',
    'A batch can only do five things: allocate a bank charge, move a supply invoice, move a clock session, add an estimate (which must be labelled ESTIMATE), and leave a note on the job. Payments are out of reach by design.',
    'Dry run is the default: the batch runs for real, reports what it would do, and undoes itself — so what you see in the preview is exactly what the apply will do.',
    'Groundwork only for now: devs and the agent use it from the database; a Banking screen to browse and revert batches comes next.',
  ],
}

export default note
