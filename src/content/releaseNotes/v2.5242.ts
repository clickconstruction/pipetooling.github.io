import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5242',
  date: '2026-10-11',
  title: 'The Bridge: the net position and cash charts break down, and the Monday sheet carries the link (link PR 11)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Press break it down on the net position chart: a waterfall of what moved it since the window opened, cash, owed to you and owed by you each by their change, then the inputs with their risks. The cash row turns red when the chart’s figure and the bank’s disagree.',
    'Press break it down on the cash chart: the window from the bank today through the receipts by how sure they are and the bills by kind to where the line ends, eight inputs with their risks, and the lowest-point line.',
    'The Monday sheet gains a tile for the weakest link: the rule, the lit link with its weeks, this week’s call, last week’s verdict, and the three readings at today’s pace. The email carries it too.',
  ],
}

export default note
