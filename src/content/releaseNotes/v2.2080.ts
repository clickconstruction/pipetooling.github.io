import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2080',
  date: '2026-08-22',
  kind: 'feature',
  title: 'Waiting to hear: every open bid, one clear summary',
  highlights: [
    'The 30/60/90-day "Sent within" filter is gone — the queue now always shows every sent bid still waiting on an answer, so nothing silently ages out of view.',
    'One plain summary line up top: how many bids need a chase, how many are still open and their dollars, and how many were never called (the bottom rollup bar folded into it).',
    'Plainer words everywhere: "all caught up" instead of "fresh", "8 of 9 need a chase" on the builder panel, and a one-line explanation of what puts a bid in the queue.',
    'The builder list scrolls on its own, so the call panel stays in view even with dozens of builders in the queue.',
  ],
}

export default note
