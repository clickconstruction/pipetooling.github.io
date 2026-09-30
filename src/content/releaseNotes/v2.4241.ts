import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4241',
  date: '2026-09-30',
  title: 'Four more date boxes save a finished date only',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'primary', 'controller'],
  highlights: [
    'Four date boxes no longer save part way through typing: the day our contract ended on Edit Job, the Sheet date on a sub sheet, a sub document’s expires date, and a partnership agreement’s sign-by date. A year typed one digit at a time used to save as the year 0002 on the first digit.',
    'A typed date saves when you press Enter or leave the box. A date picked from the calendar saves at once, as before. Emptying a box still clears the date.',
    'A date left half typed is not saved. The box goes back to what was there and a line says so.',
    'On Edit Job, the contract date box stays open while it saves, and a click on Complete, Terminated or Abandoned straight from the box lands.',
  ],
}

export default note
