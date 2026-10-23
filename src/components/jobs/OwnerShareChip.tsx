import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { cleanStoredAddress } from '../../lib/displayAddress'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  ownerShareBills,
  ownerSharePropertyState,
  ownerShareScope,
  ownerShareState,
  ownerShareWrites,
  type OwnerShareInvoice,
  type OwnerShareJob,
  type OwnerShareState,
} from '../../lib/jobs/ownerBillShare'
import { ownerSeesCard, type OwnerSeesTone } from '../../lib/jobs/ownerSeesCard'
import { applyOwnerShare, loadOwnerShareProperty, type OwnerSharePropertyJob } from '../../lib/jobs/ownerBillShareIo'
import EyeIcon from '../icons/EyeIcon'

/**
 * The owner sees the bills (v2.3827, punch list #45 PR 1), drawn since v2.5770 (punch list #145)
 * as a small eye beside the owner's 🌐 on a GC-billed job: crossed when their page shows none of
 * the bills, hollow when some, open when all — grey while nothing is billed, amber once open bills
 * exist the owner cannot see, blue when they see them. Hover or focus opens the card (the fact,
 * why, the open figure, the door); a click, or the card's door, opens the switch's window, which
 * reads every job at the property and asks. The answer stamps every open GC bill for the owner and
 * sets each job's memory for its next bills. Office roles only, as the 🌐 is.
 */
const TONE_INK: Record<OwnerSeesTone, string> = {
  grey: 'var(--text-muted)',
  amber: 'var(--text-amber-800)',
  blue: 'var(--text-blue-700)',
}

const CARD_SHOW_MS = 120
const CARD_HIDE_MS = 160

export default function OwnerShareChip({
  job,
  invoices,
  ownerName,
  gcName,
  role,
  state: stateProp,
  words = false,
  onChanged,
  onError,
}: {
  job: OwnerShareJob & { revenue?: number | string | null; payments_made?: number | string | null }
  invoices: ReadonlyArray<OwnerShareInvoice>
  ownerName: string
  gcName: string
  role: string | null | undefined
  /** The property's state when the caller already knows it (the portal window); else read from this job. */
  state?: OwnerShareState
  /** A list line: the eye with its short words beside it, in place of the card on hover. */
  words?: boolean
  onChanged?: () => void
  onError?: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [card, setCard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState<{ jobs: OwnerSharePropertyJob[]; invoices: OwnerShareInvoice[] } | null>(null)
  const [place, setPlace] = useState<{ dx: number; above: boolean }>({ dx: 0, above: false })
  const wrapRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLSpanElement>(null)
  const timers = useRef<{ show?: ReturnType<typeof setTimeout>; hide?: ReturnType<typeof setTimeout> }>({})
  const canManage = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const state = stateProp ?? ownerShareState(job, invoices)

  // The card keeps inside the viewport: it slides left when it would run past the right edge and
  // opens above the eye when there is no room under it.
  useLayoutEffect(() => {
    if (!card) return
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const dx = r.right > vw - 8 ? Math.min(0, vw - 8 - r.right + place.dx) : place.dx < 0 && r.left < 8 ? 0 : place.dx
    const above = !place.above && r.bottom > vh - 8 && r.top - r.height - 30 > 0
    if (dx !== place.dx || above !== place.above) setPlace({ dx, above })
  }, [card, place])

  useEffect(() => {
    if (!card && !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCard(false)
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, open])

  useEffect(() => () => {
    clearTimeout(timers.current.show)
    clearTimeout(timers.current.hide)
  }, [])

  if (!canManage || !state) return null

  const openBills = ownerShareBills(job, invoices)
  const openFigure = openBills.length ? Math.max(0, (Number(job.revenue) || 0) - (Number(job.payments_made) || 0)) : 0
  const view = ownerSeesCard({ state, ownerName, gcName, openBills: openBills.length, open: openFigure })

  function showCard() {
    clearTimeout(timers.current.hide)
    if (card) return
    clearTimeout(timers.current.show)
    timers.current.show = setTimeout(() => setCard(true), CARD_SHOW_MS)
  }
  function showCardNow() {
    clearTimeout(timers.current.hide)
    clearTimeout(timers.current.show)
    setCard(true)
  }
  function hideCard() {
    clearTimeout(timers.current.show)
    clearTimeout(timers.current.hide)
    timers.current.hide = setTimeout(() => {
      setCard(false)
      setPlace({ dx: 0, above: false })
    }, CARD_HIDE_MS)
  }
  function onBlur(e: React.FocusEvent) {
    if (wrapRef.current && e.relatedTarget instanceof Node && wrapRef.current.contains(e.relatedTarget)) return
    hideCard()
  }

  async function openWindow() {
    clearTimeout(timers.current.show)
    clearTimeout(timers.current.hide)
    setCard(false)
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

  const ink = TONE_INK[view.tone]
  const cardStyle: CSSProperties = {
    position: 'absolute',
    left: place.dx,
    ...(place.above ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
    zIndex: 41,
    width: 'min(300px, calc(100vw - 2rem))',
    display: 'grid',
    gap: 5,
    padding: '0.6rem 0.75rem',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
    color: 'var(--text-strong)',
    fontSize: '0.78rem',
    fontWeight: 400,
    lineHeight: 1.45,
    cursor: 'default',
    textAlign: 'left',
    whiteSpace: 'normal',
  }

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-owner-share-chip={state}
        data-owner-sees-tone={view.tone}
        aria-label={view.title}
        aria-pressed={state === 'on'}
        aria-haspopup="dialog"
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        onFocus={showCardNow}
        onBlur={onBlur}
        onClick={() => (open ? setOpen(false) : void openWindow())}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 18,
          padding: words ? '0 6px 0 3px' : '0 2px',
          border: words ? '1px solid var(--border-strong)' : 'none',
          borderRadius: words ? 999 : 4,
          background: words ? 'var(--surface)' : 'none',
          color: ink,
          font: 'inherit',
          fontSize: '0.72rem',
          fontWeight: 700,
          lineHeight: '17px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <EyeIcon variant={view.eye} size={15} />
        {words ? <span>{view.short}</span> : null}
      </button>
      {card && !open ? (
        <span ref={cardRef} role="status" data-owner-sees-card data-above={place.above ? 'true' : undefined} style={cardStyle} onMouseEnter={showCard} onMouseLeave={hideCard}>
          <strong style={{ fontSize: '0.82rem', color: ink }}>{view.title}</strong>
          <span style={{ color: 'var(--text-700)' }}>{view.why}</span>
          {view.fact ? (
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 5, color: 'var(--text-700)' }}>
              <span>{view.fact.label}</span>
              <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{view.fact.value}</strong>
            </span>
          ) : null}
          <button
            type="button"
            data-owner-sees-door
            onClick={() => void openWindow()}
            onBlur={onBlur}
            style={{ justifySelf: 'start', font: 'inherit', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {view.door} ›
          </button>
          {view.hint ? <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{view.hint}</span> : null}
        </span>
      ) : null}
      {open ? (
        <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <span
            role="dialog"
            aria-label={`What ${ownerName} sees`}
            data-owner-share-popover
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 41, width: 'min(340px, calc(100vw - 2rem))', display: 'grid', gap: 6, padding: '0.6rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', color: 'var(--text-strong)', fontSize: '0.78rem', fontWeight: 400, lineHeight: 1.4, cursor: 'default', textAlign: 'left', whiteSpace: 'normal' }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: ink }}>{view.title}</span>
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
