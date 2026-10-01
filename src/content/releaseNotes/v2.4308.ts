import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4308',
  date: '2026-10-01',
  title: 'Pricing: the ? card reads in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The four lines on the Workbench’s ? card are rewritten in short sentences, the way its walkthrough already reads: what to tap, what happens, and what the GC sees.',
    'A packet is explained as the copy of the bid one GC gets, and a preview as a price not saved yet. The card names Solver ›, Apply, Discard and ＋ Add price exactly.',
  ],
}

export default note
