import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6813',
  date: '2026-11-09',
  title: 'The rest of the Bridge leaves ZZ test jobs out: Build, the people, Sales and the Collect scorecard',
  kind: 'fix',
  highlights: [
    'An open ZZ test job no longer sits in the Build pile, the jobs sold or the work built. Four of them were there, two at about $56,000 each.',
    'Hours clocked on a test job leave the people\'s weeks and days. So do a bill sent, a payment, a percent and a report filed on one.',
    'A test job made from a bid is no sale on Sales or Market, and a payment on one is on no payer\'s line on Friday\'s Collect scorecard.',
    'The Monday sheet email follows the same rule. A dev who shows ZZ test jobs still sees them here. ZZ bids, the robots\' among them, still count as asks for now.',
  ],
}

export default note
