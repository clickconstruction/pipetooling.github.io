import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4174',
  date: '2026-09-29',
  title: 'Submittals: under the rows, what the GC’s page will read — live as you edit',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'A line under the rows quotes the GC’s page for the rows as they stand: “The GC’s page will read: ‘2 rows need a call’ — 20 rows match the plans and are marked approved. 2 differ — each says why.” It changes the moment you edit a row.',
    'It is built by the same rule the GC’s page uses, so it never says something the page would not. Until you share it ends “The GC sees nothing until you share.”; after, “That is what the link shows now.”',
  ],
}

export default note
