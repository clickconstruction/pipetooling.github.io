import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4352',
  date: '2026-10-01',
  title: 'A click outside a window closes that window only',
  kind: 'fix',
  highlights: [
    'Some windows open on top of another window. A click outside the top one used to close both. Now it closes the top one only.',
    'That covers Switch user in a person’s review, a report in a customer’s summary, the job picker in Quick assign, Assign focus in Review Hours and the Apply Schedule % check in Hours align.',
    'On the Lien desk it covers the owner’s call and Send the run, and Send the run from Put a GC on notice too. A sheet’s story keeps its portal visits and its work order the same way.',
    'On the Legal desk, a click anywhere in Apply discount closed the whole desk. Now the desk stays open, and a click outside its other windows closes that window only.',
  ],
}

export default note
