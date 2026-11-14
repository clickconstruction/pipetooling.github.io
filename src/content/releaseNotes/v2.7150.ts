import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7150',
  date: '2026-11-13',
  title: 'Punch list: By number lists every card in one list, the newest on top',
  kind: 'feature',
  highlights: [
    'The Punch list page has a View choice. By number lists every card in one list by its number, the highest first, so you can work from the newest card down.',
    'One press flips the list to the oldest first. The press says which way the list runs.',
    'A row shows the card’s number, name, group, size, shipped versions, mock-up and its Next line. Press the Next line to open the whole card with Do, Later and Drop.',
    'The Show filters still apply, and chips narrow the list to one group. The device remembers the view, and the address /punch-list?view=number opens it.',
  ],
}

export default note
