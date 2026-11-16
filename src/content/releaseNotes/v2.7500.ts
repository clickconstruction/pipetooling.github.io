import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7500',
  date: '2026-11-16',
  title: 'Bids: a promised schedule with a start and an end you type, drawn on the plans by date',
  kind: 'feature',
  highlights: [
    'Edit Bid has a Schedule row under Bid Date Sent. Type the day the promised schedule starts and the day it ends, or tick No end date.',
    'On a development’s Plans, By date draws the schedule as its own lane. The first figure says when it ends and how many days are left.',
    'Once today is past the end, a red stretch runs from the end to today and the figure counts the days over.',
    'Press a bid on the chart and Set the schedule to type the two dates without leaving the page. On a phone the key to the marks now folds behind a press.',
  ],
}

export default note
