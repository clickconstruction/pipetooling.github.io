import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6615',
  date: '2026-11-07',
  title: "An entry's section reference opens the narrative there, and a section shows the entries that cite it",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "Write N§16 in an HR entry to point at section 16 of the narrative. On the Timeline it draws as a press that opens the narrative scrolled to that section, lit for a moment.",
    "In the narrative's Jump to list, a section the entries cite shows how many. Press the count to see them, and press one to open the Timeline on that entry.",
    'Nothing is written: the references are the words already in the entries.',
  ],
}

export default note
