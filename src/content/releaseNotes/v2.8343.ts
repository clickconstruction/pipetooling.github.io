import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8343',
  date: '2026-11-23',
  title: 'Bills sent: By day paid, what came in on any given day',
  kind: 'feature',
  highlights: [
    'Bills sent has a second view, By day paid, behind a switch at the top. It shows a month of days, each with what came in that day.',
    'Press a day to see its total and the payments behind it: the bill, the job, who paid, how, and how long the money took. One deposit that paid several bills is drawn once.',
    'Press Stripe to count Stripe payments alone, with the time each customer paid. A tile shows Stripe’s next payout to the bank and the day it arrives.',
    'A green tile on the list, Paid this week, opens the view. Print prints the month a day at a time, and Download CSV saves one row for each payment.',
  ],
}

export default note
