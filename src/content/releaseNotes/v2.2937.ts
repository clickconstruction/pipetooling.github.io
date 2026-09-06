import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2937',
  date: '2026-09-06',
  title: 'One "sent" — bids are counted per bid, in the trade you\'re looking at',
  kind: 'fix',
  highlights: [
    'Every bid count now agrees: the Bid Board pills, the Followup lens headers, the "need a reason" chip and the Dashboard card all count BIDS the same way — a bid sent to three GCs is one sent bid, and the GC packets follow as a second figure ("101 bids · 107 GC packets").',
    'The scope sits on the number: on Bids every count wears the trade pill\'s name ("59 need a reason · Plumbing", or "all trades" when no pill is selected), and the Dashboard\'s lost-bids card says "· all trades" — so 60 there and 59 here explain each other.',
    'One rule for the sent date: it is the earliest send to a GC by any lane. Sending a bid room link no longer moves a date you set by hand; "Move sent date to today" on the Cover Letter is the only thing that does, and it asks first.',
    'Pricing → the green button now reads "Share with a teammate" and the panel says so: it shares the pricing package with a teammate — it does not send anything to the GC and never marks the bid sent.',
  ],
}

export default note
