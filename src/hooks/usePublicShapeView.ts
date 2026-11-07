import { useMemo } from 'react'
import { useOptionalAuth } from './useAuth'
import { publicShapeView, type PublicShapeView } from '../lib/prototypes/publicShapeView'

/**
 * A prototype's two doors on a public page (punch list #217): `?shape=1` draws the shape, `?sbs=1` the side-by-side
 * for a sample page or a signed-in dev (`lib/prototypes/publicShapeView.ts`). `token` is the page's own when it reads
 * one from its route; otherwise the URL's `t=` is read. The search is read off the window, not the router, since the
 * public pages' smokes render with no router and a public page's query never changes under it.
 */
export function usePublicShapeView(key: string, token?: string | null): PublicShapeView {
  const search = typeof window !== 'undefined' ? window.location.search : ''
  const dev = useOptionalAuth()?.role === 'dev'
  return useMemo(() => publicShapeView({ search, key, token, dev }), [search, key, token, dev])
}
