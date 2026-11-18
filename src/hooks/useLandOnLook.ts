import { useCallback, useEffect, useRef } from 'react'

/** A beat for a folded look to open before the page scrolls to it. */
export const LAND_ON_LOOK_MS = 80

/**
 * Land a page on one of its looks (punch list #379, PR 6: the Job window's **Open the site's trips** links
 * to the Development page with `?look=trips`). `asked` turns true once the link asked for the look and the
 * look is on the page; the page then opens the look if it is folded and scrolls to it, once. A look that
 * shows up late, after its read, is still landed on. A second visit to the same mounted page does not jump
 * again, so a reader who scrolled away is left where they are. `askKey` names what the link asked for (a
 * trip's id under `?trip=`): the page lands once for each, so a second link to another trip on the same
 * mounted page lands again. `targetId` names one thing inside the look to land on (a trip's row): when it
 * is on the page at the beat, the page scrolls to it and not to the look's top, in the one scroll it makes.
 * A target that is not there (a link to a trip that is gone) lands on the look's top, as before.
 *
 * It hands back the same move for a press on the page (**Open the Trips look** on the card of a trip's bar on Plans by date),
 * and the press may name a target of its own (**Open Trip 5**).
 */
export function useLandOnLook({
  asked,
  anchorId,
  unfold,
  askKey = 'look',
  targetId = null,
}: {
  asked: boolean
  anchorId: string
  /** Opens the look when it is folded. */
  unfold: () => void
  /** What was asked for; a new key lands again. */
  askKey?: string
  /** The element inside the look the link asked for; the look's top when it is not on the page. */
  targetId?: string | null
}): (targetId?: string | null) => void {
  const unfoldRef = useRef(unfold)
  unfoldRef.current = unfold
  const land = useCallback(
    (target?: string | null) => {
      unfoldRef.current()
      // One scroll a landing: to the target when it is there once the look has opened, else to the look.
      window.setTimeout(() => ((typeof target === 'string' && target ? document.getElementById(target) : null) ?? document.getElementById(anchorId))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), LAND_ON_LOOK_MS)
    },
    [anchorId],
  )
  const landed = useRef<string | null>(null)
  const targetRef = useRef(targetId)
  targetRef.current = targetId
  useEffect(() => {
    if (!asked || landed.current === askKey) return
    landed.current = askKey
    land(targetRef.current)
  }, [asked, askKey, land])
  return land
}
