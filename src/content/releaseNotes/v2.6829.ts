import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6829',
  date: '2026-11-10',
  title: 'A customer who pays in kind has a card and a ledger on their page',
  kind: 'feature',
  highlights: [
    'A customer’s page can now say they pay in kind. Press Set up paying in kind, say what they give, and tick the jobs it pays.',
    'Each thing given is one line: an amount, a date and a memo. Press Add a line. One line pays the oldest open bills in order.',
    'A line counts as overhead unless you put it on a job. The ledger shows every line, the bills it went to, and what is still to come.',
    'On that customer’s page the open balance reads as scheduled in kind, not late. Pay speed leaves in kind payments out.',
  ],
}

export default note
