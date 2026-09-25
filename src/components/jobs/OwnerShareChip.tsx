import { useState } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { cleanStoredAddress } from '../../lib/displayAddress'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  ownerShareBills,
  ownerShareChipWords,
  ownerSharePropertyState,
  ownerShareScope,
  ownerShareState,
  ownerShareWrites,
  type OwnerShareInvoice,
  type OwnerShareJob,
  type OwnerShareState,
} from '../../lib/jobs/ownerBillShare'
import { applyOwnerShare, loadOwnerShareProperty, type OwnerSharePropertyJob } from '../../lib/jobs/ownerBillShareIo'

/**
 * The owner sees the bills (v2.3827, punch list #45 PR 1): the chip beside the owner's 🌐 on a
 * GC-billed job. The first click reads every job at the property and asks; the answer stamps
 * every open GC bill for the owner and sets each job's memory for its next bills. Office roles
 * only, as the 🌐 is.
 */
export default function OwnerShareChip({
  job,
  invoices,
  ownerName,
  gcName,
  role,
  state: stateProp,
  onChanged,
  onError,
}: {
  job: OwnerShareJob
  invoices: ReadonlyArray<OwnerShareInvoice>
  ownerName: string
  gcName: string
  role: string | null | undefined
  /** The property's state when the caller already knows it (the portal window); else read from this job. */
  state?: OwnerShareState
  onChanged?: () => void
  onError?: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState<{ jobs: OwnerSharePropertyJob[]; invoices: OwnerShareInvoice[] } | null>(null)
  const canManage = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const state = stateProp ?? ownerShareState(job, invoices)
  if (!canManage || !state) return null

  async function openPopover() {
    setOpen(true)
    setScope(null)
    try {
      const loaded = await loadOwnerShareProperty(job)
      setScope({ jobs: ownerShareScope(loaded.jobs.find((j) => j.id === job.id) ?? (job as OwnerSharePropertyJob), loaded.jobs), invoices: loaded.invoices })
    } catch (e) {
      setOpen(false)
      onError?.(`Could not read the property's jobs: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const propertyState = scope ? ownerSharePropertyState(scope.jobs.map((j) => ownerShareState(j, scope.invoices))) : null
  const turningOn = propertyState !== 'on'
  const openOf = (j: OwnerSharePropertyJob) => ownerShareBills(j, scope?.invoices ?? []).length
  const owedOf = (j: OwnerSharePropertyJob) => Math.max(0, (Number(j.revenue) || 0) - (Number(j.payments_made) || 0))
  // Money only where a bill is open — a job not billed yet has nothing to show them (its contract value is not a bill).
  const total = (scope?.jobs ?? []).reduce((s, j) => s + (openOf(j) > 0 ? owedOf(j) : 0), 0)
  const address = cleanStoredAddress(scope?.jobs[0]?.job_address ?? '')

  async function apply() {
    if (!scope || busy) return
    setBusy(true)
    try {
      await applyOwnerShare(ownerShareWrites(scope.jobs, scope.invoices, turningOn))
      setOpen(false)
      onChanged?.()
    } catch (e) {
      onError?.(`Could not change what ${ownerName} sees: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const on = state === 'on'
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-owner-share-chip={state}
        aria-pressed={on}
        aria-haspopup="dialog"
        onClick={() => (open ? setOpen(false) : void openPopover())}
        title={on ? `${ownerName} sees this property's bills on their portal — for their records, no Pay button` : `${ownerName}'s portal shows none of these bills — they are billed to ${gcName || 'the GC'}. Click to show them.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 7px',
          borderRadius: 999,
          border: `1px solid ${on ? 'var(--text-blue-700)' : 'var(--border-strong)'}`,
          background: on ? 'var(--bg-blue-tint)' : state === 'partly' ? 'var(--bg-amber-tint)' : 'var(--surface)',
          color: on ? 'var(--text-blue-700)' : state === 'partly' ? 'var(--text-amber-800)' : 'var(--text-muted)',
          fontSize: '0.68rem',
          fontWeight: 700,
          lineHeight: '17px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden>{on ? '☑' : '☐'}</span>
        {ownerShareChipWords(state)}
      </button>
      {open ? (
        <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <span
            role="dialog"
            aria-label={`What ${ownerName} sees`}
            data-owner-share-popover
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 41, width: 'min(340px, calc(100vw - 2rem))', display: 'grid', gap: 6, padding: '0.6rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', color: 'var(--text-strong)', fontSize: '0.78rem', cursor: 'default', textAlign: 'left' }}
          >
            {!scope ? (
              <span style={{ color: 'var(--text-muted)' }}>Reading the property…</span>
            ) : (
              <>
                <strong style={{ fontSize: '0.82rem' }}>
                  {turningOn ? `Show ${ownerName} the bills${address ? ` at ${address}` : ''}?` : `Stop showing ${ownerName} the bills${address ? ` at ${address}` : ''}?`}
                </strong>
                <span style={{ color: 'var(--text-muted)' }}>
                  {turningOn
                    ? `Billed to ${gcName || 'the GC'}. They see each bill, what is paid and what is open, on their portal — for their records: no Pay button, not in their balance. Open bills now and every bill after.`
                    : 'Their portal stops listing these bills. Bills already paid stay in their history.'}
                </span>
                <span style={{ display: 'grid', gap: 2, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                  {scope.jobs.map((j) => (
                    <span key={j.id} data-owner-share-job={j.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · {(j.job_name ?? '').trim() || 'Job'}
                        <span style={{ color: 'var(--text-muted)' }}> · {openOf(j) > 0 ? `${openOf(j)} open bill${openOf(j) === 1 ? '' : 's'}` : 'no bill yet — shows once billed'}</span>
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{openOf(j) > 0 ? formatUsdNoCents(owedOf(j)) : '—'}</span>
                    </span>
                  ))}
                  {scope.jobs.length > 1 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{scope.jobs.length} jobs at this property · {formatUsdNoCents(total)} on open bills — the switch covers them all.</span> : null}
                </span>
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setOpen(false)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="button" data-owner-share-apply disabled={busy} onClick={() => void apply()} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: turningOn ? 'var(--text-link)' : 'var(--text-700)', color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: busy ? 'wait' : 'pointer' }}>
                    {busy ? 'Saving…' : turningOn ? 'Show them' : 'Stop showing'}
                  </button>
                </span>
              </>
            )}
          </span>
        </>
      ) : null}
    </span>
  )
}
