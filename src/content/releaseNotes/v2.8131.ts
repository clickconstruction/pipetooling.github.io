import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8131',
  date: '2026-11-20',
  title: 'Document builder: a reminder goes to the person the sheet was sent to, and says who',
  kind: 'fix',
  highlights: [
    'On a sheet’s list of trades, Send it again and Tell them it changed go to the person the sheet was sent to. A line under them names that person and their email.',
    'They used to find the person by name. With two people of one name at a trade, the reminder could reach the wrong one.',
    'When that person has left the company record, the two presses go grey and the line says so. Nobody else is picked in their place.',
  ],
}

export default note
