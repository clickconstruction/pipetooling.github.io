/**
 * The Job photos window loaded when a door is pressed (punch list #244, v2.6449). The Job Mode card's Photos line and
 * the job window's Documents door live in the app's first load, so a static import put the whole window there (the
 * shot tiles, the viewer, the outbox's door). Through this door the window is its own chunk, fetched on the press
 * (the service worker precaches it, so a phone with no signal still opens it); the Pipeline's tables import the
 * window directly, since the Jobs page is already its own chunk. *Opening the job’s photos…* answers the press while
 * the chunk arrives.
 */
import { lazy, Suspense, type ComponentProps, type CSSProperties } from 'react'
import type { JobPhotosWindow } from './JobPhotosWindow'

const Window = lazy(() => import('./JobPhotosWindow'))

const opening: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }

export function JobPhotosWindowLazy(props: ComponentProps<typeof JobPhotosWindow>) {
  return (
    <Suspense fallback={<span style={opening}>Opening the job’s photos…</span>}>
      <Window {...props} />
    </Suspense>
  )
}

export default JobPhotosWindowLazy
