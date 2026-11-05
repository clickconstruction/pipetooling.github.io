import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6547',
  date: '2026-11-05',
  title: 'By theme: read an HR file one theme at a time, open each item in a window over the list, and print or copy the theme for counsel',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The HR file gains a By theme view beside Timeline, Evidence and Narrative. Press a theme and the page holds only the items that carry it, oldest first or strongest first, with the counts you tell counsel at the top and a Show row to narrow to a grade, the items with a file, or the agent’s proposals.',
    'Press any item and it opens in a window over the list: the whole entry or memo, its files, every theme on it with why and how it proves it, the lines around it on the record, Open on the Timeline, and Previous and Next through the theme. Escape closes and the list is where you left it.',
    'Print this theme draws the list on paper; Copy as a list for counsel puts the same words on the clipboard. The theme you picked sits in the address, so a link opens the same view.',
  ],
}

export default note
