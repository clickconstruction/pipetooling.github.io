import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2795',
  date: '2026-09-04',
  title: 'Robots: the first audit pass is now doctrine',
  kind: 'feature',
  highlights: [
    'Wendi\'s answers and row notes from the 4 Sep audit pass are written into the robot estimator\'s rulebook: site and civil work is never ours, a scheduled fixture is always counted, travel and rentals are a flat human line rather than a per-mile charge, med gas is self-performed, and interceptors price at the model the plans name.',
    'Robots now ask questions in plain trade words, one ask each, anchored to a sheet — the answers "idk what this means" came from questions written in robot vocabulary.',
    'A robot may no longer open an audit before its counts are in the Counts tab — the seven "draft $0" cards in Audits came from estimates that lived only in CountTooling and the bid notes.',
    'Six robot bids that predate the pairing stamp are now paired to their reference bids, so the Audits tab seals the live one and shows "vs ours" on the backtests.',
  ],
}

export default note
