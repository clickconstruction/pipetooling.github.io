import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5957',
  date: '2026-10-26',
  title: 'Empty lists in Bids name the next press',
  kind: 'feature',
  highlights: [
    'The Bid Board and Submission follow-up: an empty board offers New Bid, a search with no match quotes what you typed and offers Clear the search, and Marked hiding every bid offers Show every bid. Each empty pile says its own state, like Nothing waiting on a GC.',
    'Bid Costs: a window with no bids or no clocked time names the window and offers Widen the window. The Working board points you to the Bid Board, and By builder says Nothing waiting on you when every builder is snoozed or PIA.',
    'The robots: an empty Ready lane on the Robot queue and a Scoreboard with no scored run offer Add the plans. Audits, Standing rulings and the Console say Nothing waiting where empty is the good state.',
    'Waiting to hear, Why we lost, a bid’s history, the price book, the quotes and price request windows, Estimators and the rules list each offer their own press, like All estimators, + Plug in a quote, + New request, Add entry or Manage columns.',
  ],
}

export default note
