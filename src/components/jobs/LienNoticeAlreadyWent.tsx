import { useEffect, useState, type ComponentProps } from 'react'
import { loadLienApplyContext, type LienApplyContext } from '../../lib/jobs/lienNoticeApplyIo'
import LienNoticeApplyPane from './LienNoticeApplyPane'
import LienNoticeByHandPane from './LienNoticeByHandPane'

/**
 * *Already mailed? Record it* (v2.7508): one door for a notice that already went. When the job's property holds a
 * notice on record under the same original contractor, the office is first asked which paper went, and it is applied
 * to this job. When none is on record, or the paper is not on the list, the step is the by-hand record as before.
 * A read that fails falls back to the by-hand record, so the door never closes on the office.
 */
type ByHandProps = ComponentProps<typeof LienNoticeByHandPane>

export default function LienNoticeAlreadyWent({
  apply,
  ...byHand
}: ByHandProps & {
  apply: {
    gcCustomerId: string | null
    /** "4107" */
    jobNumber: string
    /** The months the desk asks this job about. */
    months: ReadonlyArray<string>
    propertyKind: string
    lastWorkYmd: string | null
    userName: string
    /** The notice waiting on the desk, when there is one. */
    item: { id: string; fields: unknown; months: ReadonlyArray<string> } | null
  }
}) {
  const [ctx, setCtx] = useState<LienApplyContext | null>(null)
  const [notListed, setNotListed] = useState(false)
  const { id, customerAddressId, jobAddress } = byHand.job
  const gcCustomerId = apply.gcCustomerId

  useEffect(() => {
    let cancelled = false
    setCtx(null)
    void loadLienApplyContext({ id, customer_address_id: customerAddressId, job_address: jobAddress, gc_customer_id: gcCustomerId })
      .then((c) => { if (!cancelled) setCtx(c) })
      .catch(() => { if (!cancelled) setCtx({ papers: [], noticedMonths: [] }) })
    return () => { cancelled = true }
  }, [id, customerAddressId, jobAddress, gcCustomerId])

  if (ctx === null) {
    return (
      <div data-testid="lien-already-went-loading" style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-amber-tint)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Looking for notices already on record at this property…
      </div>
    )
  }
  if (ctx.papers.length === 0 || notListed) return <LienNoticeByHandPane {...byHand} />
  return (
    <LienNoticeApplyPane
      job={{ id, label: byHand.job.label, number: apply.jobNumber, amount: byHand.job.amount, item: apply.item }}
      papers={ctx.papers}
      noticedMonths={ctx.noticedMonths}
      months={apply.months}
      propertyKind={apply.propertyKind}
      lastWorkYmd={apply.lastWorkYmd}
      userId={byHand.userId}
      userName={apply.userName}
      onClose={byHand.onClose}
      onApplied={(r) => byHand.onRecorded({ filingIds: [r.filingId], jobs: 1 })}
      onNotListed={() => setNotListed(true)}
      layout={byHand.layout}
      onCloseWindow={byHand.onCloseWindow}
    />
  )
}
