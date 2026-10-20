import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5232',
  date: '2026-10-11',
  title: 'The Bridge: the five stages, and the weakest link lit (link PR 1)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The page opens on one rule: find the slowest step, everything waits on it. A ? beside it shows the longer reading.',
    'Under the top line, five cards read the company in flow order: Market, Sales, Build, Bill, Collect. Each shows its pile, what comes in and goes out a week, and how many weeks it would take to clear what is already waiting.',
    'The stage with the most weeks to clear reads red as the weakest link; a stage within a tenth of it reads as its pair. Bill and Collect read now; Build, Market and Sales say they are not readable yet.',
  ],
}

export default note
