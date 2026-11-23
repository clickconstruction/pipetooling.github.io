import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * The boundary a route inside the Layout puts around its own lazy page (punch list #85). An ordinary
 * crash is caught here, as the plain `ErrorBoundary` catches it. A page whose code did not come is
 * handed to the Layout's chunk boundary, so it gets the one guarded reload and the **Reload** press
 * every other page has, where the plain boundary drew small red words and nothing to press.
 */
export function RoutePageBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary chunkLoadsGoUp>{children}</ErrorBoundary>
}
