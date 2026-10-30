import { useMemo, type ReactNode } from 'react'
import type { BilledDatesLedger as LedgerModel } from '../../lib/jobs/billedDatesLedger'
import { buildBilledDatesTrack } from '../../lib/jobs/billedDatesTrack'
import { useJobDatesView } from '../../hooks/useJobDatesView'
import BilledDatesLedger from './BilledDatesLedger'
import BilledDatesTrack from './BilledDatesTrack'
import JobDatesViewSwitch from './JobDatesViewSwitch'
import { SideBySide, useShapeView } from '../prototypes/SideBySide'

/**
 * The dates block under a Billed / Collections row's money legend, behind the *Dates · Words |
 * Track* choice (v2.6139, punch list #217): Words is the ledger as it has read since v2.4168;
 * Track is the same ledger drawn on one axis against today. The switch sits in the block's
 * corner on every row and flips every row, and the Job tab, at once (`useJobDatesView`).
 */
export default function BilledDatesBlock({ ledger, todayYmd, evidence, onMoney, onLienDesk, onPaySpeeds }: { ledger: LedgerModel; todayYmd: string; /** The customer's pay history line, under the money row in Words. */ evidence?: ReactNode; onMoney?: () => void; onLienDesk?: () => void; /** The pay-speeds breakdown, the guessed tag's door in Track. */ onPaySpeeds?: () => void }) {
  const view = useJobDatesView()
  // Dev only, on ?sbs=1: today's ledger over the track, on the same row (the owner's side-by-side ask).
  const { sideBySide } = useShapeView('jobs-pipeline-1')
  const track = useMemo(() => (view === 'track' || sideBySide ? buildBilledDatesTrack(ledger, todayYmd) : null), [view, sideBySide, ledger, todayYmd])
  if (ledger.rows.length === 0) return null
  const words = <BilledDatesLedger ledger={ledger} evidence={evidence} onMoney={onMoney} onLienDesk={onLienDesk} />
  const drawn = track ? <BilledDatesTrack track={track} onMoney={onMoney} onLienDesk={onLienDesk} onPaySpeeds={onPaySpeeds} /> : null
  if (sideBySide) {
    return (
      <div data-testid="billed-dates-block" data-view="side-by-side" style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem' }}>
        <SideBySide today={words} shape={drawn} shapeLabel="With the track" testId="billed-dates-sbs" />
      </div>
    )
  }
  return (
    <div data-testid="billed-dates-block" data-view={view} style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem' }}>
      <JobDatesViewSwitch size="row" />
      {view === 'track' && drawn ? drawn : words}
    </div>
  )
}
