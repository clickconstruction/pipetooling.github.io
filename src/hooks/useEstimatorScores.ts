import { useEffect, useState } from 'react'
import { fetchEstimatorScores } from '../lib/scorecard/teamScoresIo'
import type { EstimatorScoresWire } from '../lib/scorecard/scorecardWire'

/** The window the Bid Board's row and chips read: the Scores tab's own default. */
export const MY_SCORE_WINDOW_DAYS = 56

/**
 * The estimating score for the Bid Board (punch list #360, PR 5): `bids` for the scoreboard's gate, `mine` for
 * everyone else. One read per board. A failed read, or a function not deployed yet, gives nothing: the row and the
 * chips are a help, and the board never waits on them.
 */
export function useEstimatorScores(view: 'bids' | 'mine' | null, fetcher: typeof fetchEstimatorScores = fetchEstimatorScores): EstimatorScoresWire | null {
  const [read, setRead] = useState<EstimatorScoresWire | null>(null)
  useEffect(() => {
    setRead(null)
    if (!view) return
    let live = true
    fetcher(MY_SCORE_WINDOW_DAYS, view)
      .then((a) => {
        if (live && a.kind === 'scores') setRead(a.read)
      })
      .catch(() => {
        /* no row and no chips */
      })
    return () => {
      live = false
    }
  }, [view, fetcher])
  return read
}
