import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3099',
  date: '2026-09-07',
  title: 'Backtest scores name their teacher too',
  kind: 'feature',
  highlights: [
    'Every robot backtest score now records whose sent number it was measured against, the same way shadow scores do, and the Scoreboard ledger fills in the Teacher column for them.',
    'Backtests against an estimator who is not a calibration standard show as PRACTICE and no longer count toward Gate B, so the readiness bars reflect only the standard you chose in Settings → Digital twins.',
    'Existing scores are filled in from their reference bids: 23 runs, 18 against Wendi, 3 against Malachi, 2 against William.',
  ],
}

export default note
