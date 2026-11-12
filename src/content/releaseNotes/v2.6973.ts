import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6973',
  date: '2026-11-11',
  title: 'The Bridge’s pipe stands up, and Market reads at what it is worth',
  kind: 'feature',
  highlights: [
    'On the Bridge, the pipe of five steps now runs down the page. Each step has its own row, with its dollars a week beside it. At a desk the pipe sits beside the week’s call.',
    'Market’s row reads what the asks are worth a week. Bids count at the won rate for bids their size. Estimates count at the estimates’ own won rate.',
    'A bid counts as won or lost only when it is marked. A bid with no mark counts as half lost after 90 days and 95% lost after 180 days. An estimate with no answer counts as lost after 90 days.',
    'Press How Market’s figure is counted under the pipe to read the working. The Market and Sales cards behind The flow still count the old way for now.',
  ],
}

export default note
