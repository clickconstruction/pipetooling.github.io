import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7516',
  date: '2026-11-16',
  title: 'Lien window: the notice tab says when the Lien desk holds the approved notice',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A job’s Lien window can print a notice of its own: one set of pages, built new from the job, with no signature. When the Lien desk already held that job’s approved notice, nothing on the tab said so, and a second, unsigned paper could go out beside the signed one.',
    'The tab now shows an amber note over its buttons when the desk holds the approved notice, or has printed it and waits on its mail numbers. It says to print or finish that one on the desk.',
    'The note has a press, Open it on the Lien desk, that goes straight to the notice. The tab’s own Print is still there for a job with nothing on the desk.',
  ],
}

export default note
