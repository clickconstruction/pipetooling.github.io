import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6918',
  date: '2026-11-10',
  title: 'Lien desk: send every drafted affidavit and print every ready one, a press each',
  kind: 'feature',
  highlights: [
    'After Redraw on the short form, a new press at the top of the Affidavits list sends every drafted affidavit for approval at once. Its window says how many a GC’s standing rule approves and how many go to the leader.',
    'A second press prints every ready affidavit on the short form for the notary. Each one starts on its own sheet.',
    'Each job keeps its own printed copy, the same as printing from its Lien window.',
    'A paper nobody has drafted, and a ready one still on the earlier form, are left out. A line under each press says so.',
  ],
}

export default note
