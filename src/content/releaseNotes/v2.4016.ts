import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4016',
  date: '2026-09-28',
  title: 'GC Review call sheet: the bills behind each total',
  kind: 'feature',
  highlights: [
    'On the call sheet, each GC’s total opens onto the bills that make it up: the job, who was billed, when, how many days ago, what is still owed and the date it was promised. They come to the total on the row. Show all bills opens every GC’s at once.',
    'Dig in without losing the sheet: a bill’s job name opens the job on top, and the ▾ at the end of a line drops that job’s latest activity under it. What you typed is still there when you come back.',
    'A GC’s bills in Collections are listed apart, with a line saying they are owed and are not in the total above.',
    'The help guide now says where Save answers goes: each answer is that GC’s word for the week, shown on its row, the Temperature tab and What went out, with the pay date filed on its bills.',
  ],
}

export default note
