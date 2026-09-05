import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2882',
  date: '2026-09-05',
  title: "A link that isn't for your role now says so — and lands you somewhere useful",
  kind: 'fix',
  highlights: [
    'Open a link to a page your role can\'t use — the owner\'s Crew P&L, a Payroll or Hours tab, a Bids office tab — and you get one plain sentence ("Crew P&L is for the owner — you\'re on Reports.") on a tab you can actually use. No more silently arriving somewhere else, and no more tab strip over a blank page.',
    'The Pipeline money-view link no longer opens the report and then prints "not allowed": it says whose report it is and leaves you on the board. If a report the server refuses does open, it reads "You don\'t have access to this report" instead of the raw database message.',
    'Imitate (dev) lands on the imitated role\'s home page, not the Dispatch schedule.',
    'Helpers and subs keep their quiet bounces — a link that isn\'t theirs still just lands on their Dashboard.',
  ],
}

export default note
