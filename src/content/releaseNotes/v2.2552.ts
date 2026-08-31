import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2552',
  date: '2026-08-31',
  title: 'Robot estimators can measure pipe runs off the plans',
  kind: 'infra',
  highlights: [
    'New footage tool traces the actual drawn pipe runs on vector plan sets — separating water, waste, fire, and storm lines by drafting pen — instead of estimating lengths from building size.',
    'Building the tool also caught a backtest that had been scored against the wrong plan package, adding a new safeguard: reference takeoffs are now cross-checked against the plan set before any score counts.',
  ],
}

export default note
