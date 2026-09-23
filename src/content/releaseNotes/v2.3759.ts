import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3759',
  date: '2026-09-23',
  title: 'The Lien desk and the GC-run preview show the pay codes page before it goes',
  kind: 'feature',
  highlights: [
    'The Lien desk’s notice pane stacks the pages as the packet prints them, and the pay codes page is now the last of them — Page 3 of 3 · pay codes — with a line saying how many bills and how much is still owed. Nothing on it is typed; it is filled from the bills.',
    'Preview in a new window carries the same page, labelled, and follows the desk as the wording changes.',
    'Put a GC on notice → Preview all: the Owner’s copy reads the cover letter, then the notice, then the pay codes; the GC’s copy stays the form alone. ‹ › walk the run without refetching a job twice.',
  ],
}

export default note
