import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1990',
  date: '2026-08-21',
  title: 'Waiting to hear — chase recent sent bids for answers and bid tabs',
  kind: 'feature',
  highlights: [
    'The Bids Followup tab gains a fourth lens: Waiting to hear. The queue is every sent bid with no outcome yet, newest first — the recent ones where feedback and bid tabs still live.',
    'One builder per call: tappable phone, a street-name pill for each pending bid (green when recently touched), and per bid the sent date, value, due date, and how long since anyone talked to them.',
    'A "Sent within" window (30 / 60 / 90 days / All, default 60) keeps the queue focused on the recent past instead of the whole backlog.',
    'The rollup below tells the honest story: how much sent work is still open, how many bids were never chased after sending, and the oldest untouched one.',
  ],
}

export default note
