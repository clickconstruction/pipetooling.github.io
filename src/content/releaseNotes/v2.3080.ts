import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3080',
  date: '2026-09-07',
  title: 'Robot scores say whose number they beat — and which plans robots can’t open',
  kind: 'feature',
  highlights: [
    'Every shadow score now names the estimator whose sent number it was measured against. Only a calibration-standard estimator counts toward Gate B; anyone else shows as practice on the Scoreboard and Shadows lenses.',
    'The Bid Board robot icon turns red with an ✕ when the plans link is one the robots cannot open (not shared, a folder link, not a PDF), and the tooltip says what to fix.',
    'The Scoreboard lists live bids whose plans are unreadable by robots, so coverage gaps caused by a bad link are visible instead of silent.',
    'Robot shadow dispatch skips those bids automatically and re-checks links daily.',
  ],
}

export default note
