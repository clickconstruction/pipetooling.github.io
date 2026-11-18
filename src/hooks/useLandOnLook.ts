import { useCallback, useEffect, useRef } from 'react'

/** A beat for a folded look to open before the page scrolls to it. */
export const LAND_ON_LOOK_MS = 80

/**
 * Land a page on one of its looks (punch list #379, PR 6: the Job window's **Open the site's trips** links
 * to the Development page with `?look=trips`). `asked` turns true once the link asked for the look and the
 * look is on the page; the page then opens the look if it is folded and scrolls to it, once. A look that
 * shows up late, after its read, is still landed on. A second visit to the same mounted page does not jump
 * again, so a reader who scrolled away is left where they are.
 *
 * It hands back the same move for a press on the page (**Open the Trips look** on the card of a trip's bar on Plans by date).
 */
export function useLandOnLook({ asked, anchorId, unfold }: { asked: boolean; anchorId: string; /** Opens the look when it is folded. */ unfold: () => void }): () => void {
  const unfoldRef = useRef(unfold)
  unfoldRef.current = unfold
  const land = useCallback(() => {
    unfoldRef.current()
    window.setTimeout(() => document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), LAND_ON_LOOK_MS)
  }, [anchorId])
  const landed = useRef(false)
  useEffect(() => {
    if (!asked || landed.current) return
    landed.current = true
    land()
  }, [asked, land])
  return land
}
