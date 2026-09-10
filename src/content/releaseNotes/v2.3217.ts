import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3217',
  date: '2026-09-10',
  title: 'Robots tab tidied — a filter on Audits, a leaner Robot Board',
  kind: 'fix',
  highlights: [
    'Audits has a filter row — All, Backtests, Shadows, Asking you — each with its count, so you can get to just the shadows or just the audits with a question waiting on you. The order inside stays “what your verdict unblocks”.',
    'The Robot Board no longer carries the human board’s map, distance rail, pulse and estimating-health sections — those meant nothing over robot practice bids. Same rows, same actions, less to scroll past.',
    'Bid numbers inside a robot’s question now link the same way on Settings → Digital twins as they do in Standing rulings, including the green “ours b214” link to the human bid a robot copy came from.',
    'Queue and Shadows stopped telling you to click a yellow robot that no longer exists — a bid goes to the front of the line from its robot icon on the Bid Board.',
  ],
}

export default note
