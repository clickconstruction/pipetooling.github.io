import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useUserReviewModal } from '../../contexts/UserReviewModalContext'

const DEEPLINK_PARAM_USER = 'userReview'
const DEEPLINK_PARAM_RANGE = 'userReviewRange'
const DEEPLINK_PARAM_YMD = 'userReviewYmd'

/**
 * Opens the User Review modal when the URL carries `?userReview=<uuid>[&userReviewRange=day|week][&userReviewYmd=YYYY-MM-DD]`.
 * Removes the deeplink params after opening so re-clicking the same link works after dismissal.
 *
 * Mounted globally from `Layout.tsx` so it's reachable from any route.
 */
export function UserReviewDeepLinkHandler() {
  const [searchParams, setSearchParams] = useSearchParams()
  const modal = useUserReviewModal()
  const handlingRef = useRef<string | null>(null)

  useEffect(() => {
    if (!modal) return
    const userId = searchParams.get(DEEPLINK_PARAM_USER)?.trim()
    if (!userId) return
    if (handlingRef.current === userId) return
    handlingRef.current = userId

    const ymd = searchParams.get(DEEPLINK_PARAM_YMD)?.trim() || undefined

    void (async () => {
      let displayName = 'Loading…'
      try {
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .maybeSingle()
        if (!error && data) {
          const name = (data as { name?: string | null }).name?.trim()
          if (name) displayName = name
          else displayName = 'Unknown user'
        }
      } catch {
        // Non-fatal: open with placeholder name.
      }
      modal.open({ userId, displayName, workDateYmd: ymd })

      // Clear the params so the link is re-usable. Preserve any non-deeplink params.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete(DEEPLINK_PARAM_USER)
          next.delete(DEEPLINK_PARAM_RANGE)
          next.delete(DEEPLINK_PARAM_YMD)
          return next
        },
        { replace: true },
      )
    })()
  }, [searchParams, setSearchParams, modal])

  return null
}
