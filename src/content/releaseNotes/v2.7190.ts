import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7190',
  date: '2026-11-13',
  title: 'New task on a phone: the names show under the search, and Repeats is not cut off',
  kind: 'fix',
  highlights: [
    'In New task, tap Someone else and then the search box. The box now moves to the top of the window, so the names it finds show under it. Before, they were hidden behind the Send bar until you swiped.',
    'On a narrow phone, or with Safari\'s text set larger, the last word of the When bar was cut off. Today, Tomorrow, Pick a day and Repeats now all fit.',
  ],
}

export default note
