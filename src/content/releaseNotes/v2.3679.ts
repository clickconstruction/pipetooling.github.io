import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3679',
  date: '2026-09-21',
  title: 'Lien desk: a window that closes with nothing recorded is named the day it happens',
  kind: 'feature',
  highlights: [
    'A month whose notice window closed with no notice sent and no skip recorded used to disappear quietly. Now the Dashboard’s Needs you names it in red — the job, the month and the dollars — and stays until someone notes it.',
    'On the desk, Missed is a lens as well as a pile: a job that still has open months keeps its place under To draft, but it counts under Missed, its row says which month closed, and a red strip on the pane says the same with one button, Note it as missed.',
    'Noting it is not a skip. It writes down that a person saw the loss, with a name and a date, on the month’s record under Earlier months. The balance is still owed and rides on the notice for the months that are open.',
  ],
}

export default note
