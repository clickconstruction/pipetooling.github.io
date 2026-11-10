import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6871',
  date: '2026-11-10',
  title: 'Materials: on a narrow window the tab groups fold to their name, where the last one used to drop to a second row',
  kind: 'feature',
  highlights: [
    'When Plan, Purchase and Track do not fit one row, the groups that do not fit fold to their name. The group you are in stays open, and so does any other that still fits.',
    'Press a folded name and its tabs open. The page does not change until you press a tab. A folded group keeps its badge and names the tab you are on.',
    'On a phone the three names sit in a row with the open group under them. Pressing a name shows its tabs and no longer jumps to its first page.',
    'Scan a label and Print labels now sit at the right end of the row, with Print labels last.',
  ],
}

export default note
