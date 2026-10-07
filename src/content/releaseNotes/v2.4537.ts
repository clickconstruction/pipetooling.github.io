import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4537',
  date: '2026-10-05',
  title: 'Submittals: the Edit window fits on one screen',
  kind: 'feature',
  highlights: [
    'Edit on a submittal row is wider and shorter. Each part is one line under headings, where it took three lines before. A fixture with eight parts now fits on about one screen.',
    'Parts sit in groups: the ones the GC sees first, then order only, then left out. A small Shown to menu on each line moves a part between groups.',
    'A part the GC rejected, approved or sent back says so under its name, with the day and their note. An empty lead time shows "add" in amber.',
    'The window is titled with the row, like "Edit LAV-1", and the status the row has is lit. A row added by hand opens as "Add a row", and Save waits for a tag or a product.',
  ],
}

export default note
