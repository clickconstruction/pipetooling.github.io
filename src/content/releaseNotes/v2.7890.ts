import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7890',
  date: '2026-11-18',
  title: 'Pricing calculator: Put on a row… waits for the row before it shows a change',
  kind: 'fix',
  highlights: [
    'Put on a row… used to open as if a new row were coming: the bid’s revenue already showed the number added and the grey button said Add.',
    'Now the window asks for the row first. The bid’s revenue reads as it stands and the button says Set a row to $900.00.',
    'Once you pick the row, the window draws that row with its new price, as before.',
  ],
}

export default note
