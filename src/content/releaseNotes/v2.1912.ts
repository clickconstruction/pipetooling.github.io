import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1912',
  date: '2026-08-20',
  title: 'Pricing Workbench: scenarios and your win/loss history',
  kind: 'feature',
  highlights: [
    'Scenario cards sit above the Workbench totals — one per pricing, showing its revenue, margin, and profit side by side. Click to switch; Duplicate forks a what-if without touching the original. The Active card is what your Cover Letter uses.',
    'A new strip shows this bid’s margin against your own history: green dots where you won, red dots where you lost on price, and a marker that moves as you re-price — with a plain-English verdict like "In your winning range."',
    'History margins are estimated from your cost estimates and appear once there are at least three decided bids to compare against.',
  ],
}

export default note
