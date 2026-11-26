import { useCallback, useMemo, useRef, useState } from 'react'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { loadSwipeSignState, saveSwipeSignState, swipeSignLearned, swipeSignMayPlay, swipeSignPlayed, type SwipeSignWay } from '../lib/swipeSign'

/** What a `SwipeAwayRow` needs to show the sign: whether it still may, and where to say that it did. */
export type SwipeRowSign = {
  mayPlay: () => boolean
  /** `moved` is false when the person asked for less motion and the row stayed still. */
  played: (moved: boolean) => void
}

/**
 * One way of the sign that a row swipes, for one card (punch list #426, `swipeSign.ts`). The card hands
 * `sign` to its first row, calls `learned` when the person makes the swipe themselves, and draws the
 * gesture's words under its heading while `wordsUp` is true, which is the visit of a person who asked for
 * less motion. The count is read from storage at the moment of asking, so two cards on one page share
 * it: the first to show the sign keeps the other still. A card shows it once while it stays on the page,
 * whatever storage says, so View as, where nothing is kept, does not show it over and over.
 */
export function useSwipeSign(userId: string | null | undefined, way: SwipeSignWay): { sign: SwipeRowSign | undefined; wordsUp: boolean; learned: () => void } {
  const [wordsUp, setWordsUp] = useState(false)
  const shownHere = useRef(false)
  const sign = useMemo<SwipeRowSign | undefined>(() => {
    if (!userId) return undefined
    return {
      mayPlay: () => !shownHere.current && swipeSignMayPlay(loadSwipeSignState(userId), way, todayYmdInAppTz()),
      played: (moved) => {
        shownHere.current = true
        saveSwipeSignState(userId, swipeSignPlayed(loadSwipeSignState(userId), way, todayYmdInAppTz()))
        if (!moved) setWordsUp(true)
      },
    }
  }, [userId, way])
  const learned = useCallback(() => {
    setWordsUp(false)
    if (!userId) return
    const before = loadSwipeSignState(userId)
    const after = swipeSignLearned(before, way)
    if (after !== before) saveSwipeSignState(userId, after)
  }, [userId, way])
  return { sign, wordsUp, learned }
}
