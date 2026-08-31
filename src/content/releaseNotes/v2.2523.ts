import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2523',
  date: '2026-08-30',
  title: 'Robot estimators can open backtests and keep their own logs',
  kind: 'feature',
  highlights: [
    'The robot can now open a blind backtest of a past bid by itself — it copies only the job logistics, never the human prices or outcome, so the comparison stays honest by construction.',
    'It can also write its own pipeline log entries on its bids, so every step of a robot estimate is recorded without staff help.',
  ],
}

export default note
