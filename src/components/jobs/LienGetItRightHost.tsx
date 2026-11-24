import type { ReactNode } from 'react'
import type { OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import LienGetItRight, { LienRunDoor, LienRunReadFailure, type LienGetItRightProps } from './LienGetItRight'

/**
 * Where the run stands in To do's frame (punch list #362, step 5). The frame holds three parts, the Board, the find
 * box and the list (`lienDoNowFrame`), and this is the third: the run's door over the list while the run is shut,
 * and the checklist in the list's place while it is open. Where the list is its own scroller the door stays put over
 * it. With no run (nothing dated ahead, or the left-out rows not read yet) it is the list alone, as before.
 */
export default function LienGetItRightHost({
  run,
  open,
  failure,
  onOpen,
  onRetry,
  scrolls,
  children,
  ...view
}: Omit<LienGetItRightProps, 'run'> & {
  run: LienGetItRightProps['run'] | null
  open: boolean
  /** The read of the left-out papers failed: said in the door's place, with the way to read again. */
  failure: OfflineRecoveryLastError | null
  onOpen: () => void
  onRetry: () => void
  /** The list under the Board. */
  children: ReactNode
}) {
  if (run && open) return <LienGetItRight {...view} run={run} scrolls={scrolls} />
  if (!run && !failure) return <>{children}</>
  return (
    <div data-lien-run="host" style={scrolls ? { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 } : undefined}>
      {failure ? <LienRunReadFailure failure={failure} isMobile={view.isMobile} onRetry={onRetry} /> : run ? <LienRunDoor run={run} isMobile={view.isMobile} onOpen={onOpen} /> : null}
      {children}
    </div>
  )
}
