import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8270',
  date: '2026-11-21',
  title: 'Lien desk: four small fixes to the last day of work, the calendar and the tabs',
  kind: 'fix',
  highlights: [
    'The press that undoes a last day of work set by hand now says where the day goes back to. On a job with no clock hours it names the bill’s day or the job’s creation day, where it always said the creation day.',
    'The line under the open date box for the last day of work reads across the row, where it was squeezed into three short lines.',
    'On a narrow timeline calendar, a caption and the word today no longer run past the right edge.',
    'The desk’s tabs keep their width after a window is dragged from a phone’s width to a computer’s.',
  ],
}

export default note
