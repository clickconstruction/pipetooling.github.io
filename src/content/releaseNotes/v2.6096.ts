import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6096',
  date: '2026-10-29',
  title: 'Needs you: the statement round and a returned check open in place',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'On the Dashboard and on Quickfill’s Today’s lines, the GC statements line now opens GC Review right over the card, the same window the Pipeline opens, with the week’s rows, the send, the word and the print. Close it and the line re-reads.',
    'A check that came back opens its case right over the card too, on top of To match in the deposits window, with its next step. With several, the window opens on the list of them.',
    'Nothing else moves: the Pipeline’s GC Review and Accounts receivable work as before, and both now share one print and one copy-for-email with the windows.',
  ],
}

export default note
