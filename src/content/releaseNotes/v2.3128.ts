import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3128',
  date: '2026-09-08',
  title: 'Edit Job: a Stages read-out with the eye, and "See it as the customer"',
  kind: 'feature',
  highlights: [
    'Above the job details on the Edit tab, Stages reads the plan set on Bill — 4 in order · 2 any time · 5 shown to the GC — with each stage\'s draw and where it stands. The eye on each row says whether the GC sees it; click to flip.',
    'See it as the customer opens a drawer beside the dialog with the GC\'s stage card exactly as their portal will draw it, updating as you edit — only rows with the eye on, never a sub\'s name.',
    'Jobs → Subs → Work: the Offer to GC, Withdraw and Offer several together buttons are gone; the GC chip now reads the eye (On Summit\'s portal › or Not shown · set on Edit). When a stage passes inspection, the next in-order stage\'s eye turns on by itself or the dispatch inbox asks, as before.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
