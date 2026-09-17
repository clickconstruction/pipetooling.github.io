import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import type { useBidBoardJobAccountStrips } from '../../hooks/useBidBoardJobAccountStrips'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { buildJobAccountMailtoUrl, jobAccountMailtoTooLong } from '../../lib/supplyHouseJobAccount'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { composeRepEmailForProperties, repFirstName, type BidPacketFacts } from '../../lib/jobs/jobAccountRepEmail'
import { fetchBidPacketFacts } from '../../lib/jobs/bidPacketFacts'
import { logJobAccountAskByEmail } from '../../lib/jobs/logJobAccountAsk'
import {
  askRepLabel,
  buildJobAccountsLens,
  describeStart,
  emailableRows,
  lensRollup,
  startTone,
  type JobAccountsLensBid,
  type JobAccountsLensGroup,
  type JobAccountsLensRow,
} from '../../lib/bids/jobAccountsLens'
import { MarkJobAccountOpenedModal } from '../materials/MarkJobAccountOpenedModal'

type Props = {
  bids: BidWithBuilder[]
  /** The page's one `list_bid_job_account_strip` read (shared with the board's chips and the Followup count). */
  strips: ReturnType<typeof useBidBoardJobAccountStrips>
  ledgerPrefixMap: LedgerPrefixMap
  authUserId: string | null
  narrowViewport640?: boolean
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }
const rollupPill: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-700)' }
const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const smallBtn: CSSProperties = { padding: '0.25rem 0.65rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
const primaryBtn: CSSProperties = { ...smallBtn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const ghostBtn: CSSProperties = { ...smallBtn, border: 'none', color: 'var(--text-muted)' }
const band: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.65rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, flexWrap: 'wrap' }
const jobPill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.1rem 0.45rem', borderRadius: 9999, border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }
const requestedChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 6, padding: '0 0.4rem', fontSize: '0.66rem', fontWeight: 600, lineHeight: 1.5, background: '#f5f3ff', color: 'var(--text-violet-700)', whiteSpace: 'nowrap' }
const noneChip: CSSProperties = { ...requestedChip, background: 'transparent', color: 'var(--text-muted)', fontWeight: 500, border: '1px dashed var(--border-strong)' }

function estimatorNameOf(bid: BidWithBuilder): string | null {
  const est = bid.estimator
  const one = Array.isArray(est) ? est[0] : est
  return (one?.name ?? '').trim() || null
}

function toLensBid(bid: BidWithBuilder, prefixMap: LedgerPrefixMap): JobAccountsLensBid {
  const num = (bid.bid_number ?? '').trim()
  return {
    id: bid.id,
    label: num ? formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), num) : (bid.project_name ?? '').trim() || bid.id.slice(0, 8),
    projectName: bid.project_name,
    gcName: (bid.bids_gc_builders?.name ?? '').trim() || (bid.customers?.name ?? '').trim() || null,
    address: bid.address,
    estimatorName: estimatorNameOf(bid),
    estimatorUserId: bid.estimator_id,
    accountManagerUserId: bid.account_manager_id,
    startDate: bid.estimated_job_start_date,
    wonDate: bid.outcome_at,
  }
}

function jobLabelOf(row: JobAccountsLensRow): string {
  return row.job ? `${effectiveJobLedgerNumber(row.job.hcpNumber, row.job.clickNumber) || '—'} · ${(row.job.name ?? '').trim() || row.projectName}` : row.projectName
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The Job accounts lens (to-dos/bid-board-job-accounts, PR 1b): every won or
 * started bid whose job still needs a supply-house account, soonest first
 * parts run first, grouped by house with the rep named. Mark opened / Not
 * needed per row (the existing sheet), "Open the job first" for a won bid
 * with no job, and from a house's band one email across the ticked
 * properties — "Sent — log all" marks each job requested. Reads the same
 * page-wide strip as the board's chips (v2.3520); nothing new on the server.
 */
export function BidsJobAccountsLens({ bids, strips, ledgerPrefixMap, authUserId, narrowViewport640 = false }: Props) {
  const { user: authUser, profileName } = useAuth()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const [onlyMine, setOnlyMine] = useState(false)
  const [sheet, setSheet] = useState<{ row: JobAccountsLensRow; mode: 'open' | 'not_needed' } | null>(null)
  const [compose, setCompose] = useState<{ houseId: string; ticked: Set<string>; stage: 'compose' | 'confirm' } | null>(null)
  const [facts, setFacts] = useState<Record<string, BidPacketFacts | undefined>>({})
  const [org, setOrg] = useState(() => getPhysicalInvoiceIssuerForDocument())
  const [busy, setBusy] = useState(false)

  const wonBids = useMemo(() => bids.filter((b) => b.outcome === 'won' || b.outcome === 'started_or_complete'), [bids])
  const lensBids = useMemo(() => wonBids.map((b) => toLensBid(b, ledgerPrefixMap)), [wonBids, ledgerPrefixMap])
  const today = useMemo(() => new Date(), [])
  const lens = useMemo(() => buildJobAccountsLens(lensBids, strips.byBid, { authUserId, today, onlyMine }), [lensBids, strips.byBid, authUserId, today, onlyMine])

  const composeGroup: JobAccountsLensGroup | null = compose ? lens.groups.find((g) => g.houseId === compose.houseId) ?? null : null
  const composeRows = useMemo(() => (composeGroup ? emailableRows(composeGroup) : []), [composeGroup])
  const tickedRows = useMemo(() => (compose ? composeRows.filter((r) => compose.ticked.has(r.key)) : []), [compose, composeRows])

  // The facts each ticked property's block is written from — fetched once per bid when the band opens.
  useEffect(() => {
    if (!composeGroup) return
    const wanted = emailableRows(composeGroup).filter((r) => !facts[r.bidId])
    if (wanted.length === 0) return
    let cancelled = false
    void (async () => {
      const [packets] = await Promise.all([
        Promise.all(wanted.map((r) => fetchBidPacketFacts(r.bidId, r.job?.id ?? null, r.jobAddress).then((f) => [r.bidId, f] as const))),
        fetchPhysicalInvoiceIssuerFromAppSettings().catch(() => undefined),
      ])
      if (cancelled) return
      setFacts((prev) => {
        const next = { ...prev }
        for (const [id, f] of packets) next[id] = f
        return next
      })
      setOrg(getPhysicalInvoiceIssuerForDocument())
    })()
    return () => {
      cancelled = true
    }
  }, [composeGroup, facts])

  const rep = composeGroup?.rep ?? null
  const ready = tickedRows.every((r) => facts[r.bidId])
  const email = useMemo(() => {
    if (!composeGroup || !rep || tickedRows.length === 0 || !ready) return null
    const properties = tickedRows.map((r) => facts[r.bidId]).filter((f): f is BidPacketFacts => f != null)
    return composeRepEmailForProperties({ repFirstName: repFirstName(rep.name), houseName: composeGroup.houseName, properties, org: { companyName: org.companyName, officePhone: org.phone }, senderName: profileName ?? '' })
  }, [composeGroup, rep, tickedRows, ready, facts, org, profileName])
  const mailto = email && rep?.email ? buildJobAccountMailtoUrl([{ label: rep.name, email: rep.email }], email.subject, email.text) : null
  const tooLong = mailto ? jobAccountMailtoTooLong(mailto) : false

  function openCompose(group: JobAccountsLensGroup) {
    setCompose({ houseId: group.houseId, ticked: new Set(emailableRows(group).map((r) => r.key)), stage: 'compose' })
  }
  function toggle(key: string) {
    setCompose((c) => {
      if (!c) return c
      const ticked = new Set(c.ticked)
      if (ticked.has(key)) ticked.delete(key)
      else ticked.add(key)
      return { ...c, ticked, stage: 'compose' }
    })
  }
  async function copy() {
    if (!email || !rep?.email) return
    try {
      await navigator.clipboard.writeText(`To: ${rep.email}\nSubject: ${email.subject}\n\n${email.text}`)
      showToast('Copied — paste it into your email.', 'success')
      setCompose((c) => (c ? { ...c, stage: 'confirm' } : c))
    } catch {
      showToast('Could not copy.', 'error')
    }
  }
  async function logAll() {
    if (!composeGroup || !rep?.email || busy || !authUser?.id || tickedRows.length === 0) return
    setBusy(true)
    let logged = 0
    try {
      for (const r of tickedRows) {
        if (!r.job) continue
        await logJobAccountAskByEmail({ jobId: r.job.id, houseId: r.houseId, bidId: r.bidId, rep: { name: rep.name, email: rep.email }, userId: authUser.id, senderName: profileName ?? '' })
        logged++
      }
      showToast(`Logged — ${logged} job${logged === 1 ? '' : 's'} read requested at ${composeGroup.houseName} until they are marked opened.`, 'success')
      setCompose(null)
      strips.reload()
    } catch (e) {
      showToast(e instanceof Error ? `${e.message}${logged > 0 ? ` (${logged} logged before the error)` : ''}` : 'Could not log the send.', 'error')
      strips.reload()
    } finally {
      setBusy(false)
    }
  }

  const rowActions = (r: JobAccountsLensRow) => {
    if (!r.job) {
      return jobFormModal ? (
        <button type="button" style={smallBtn} onClick={() => jobFormModal.openNewJob({ prefillBidId: r.bidId })} title="You won it — open a job from this bid; the account is asked for once the job exists">
          Open the job first
        </button>
      ) : null
    }
    return (
      <>
        <button type="button" style={smallBtn} onClick={() => setSheet({ row: r, mode: 'open' })} data-testid="lens-mark-opened">
          Mark opened…
        </button>
        {r.state === 'none' ? (
          <button type="button" style={ghostBtn} onClick={() => setSheet({ row: r, mode: 'not_needed' })}>
            Not needed
          </button>
        ) : null}
      </>
    )
  }

  const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0.65rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', flexWrap: narrowViewport640 ? 'wrap' : 'nowrap' }
  const c1: CSSProperties = { flex: '0 0 7.5rem', fontWeight: 600, fontSize: '0.75rem' }
  const c2: CSSProperties = { flex: '1.5 1 0', minWidth: narrowViewport640 ? '100%' : 0 }
  const c3: CSSProperties = { flex: '1.4 1 0', minWidth: narrowViewport640 ? '100%' : 0, display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }
  const c4: CSSProperties = { flex: '1 0 auto', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }
  const toneColor = (tone: 'red' | 'amber' | null): string => (tone === 'red' ? 'var(--text-red-700)' : tone === 'amber' ? 'var(--text-amber-700)' : 'var(--text-700)')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} data-testid="job-accounts-lens">
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            Job accounts
            {strips.loaded ? <span style={rollupPill} data-testid="lens-rollup">{lensRollup(lens)}</span> : null}
            <span style={{ ...muted, fontWeight: 400 }}>of {wonBids.length} won or started · soonest first parts run first</span>
          </div>
          <label style={{ ...muted, display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only my bids
          </label>
        </div>
        {!strips.loaded ? (
          <p style={{ margin: 0, ...muted }}>Reading the accounts…</p>
        ) : lens.groups.length === 0 ? (
          <p style={{ margin: 0, ...muted }} data-testid="lens-empty">
            {onlyMine ? 'Every job on your won bids has its accounts — nothing to ask.' : 'Every won job has its accounts — nothing to ask.'}
          </p>
        ) : (
          lens.groups.map((group) => {
            const canEmail = emailableRows(group)
            const composing = compose?.houseId === group.houseId
            return (
              <div key={group.houseId} style={{ display: 'flex', flexDirection: 'column' }} data-testid="lens-house" data-house={group.houseName}>
                <div style={band}>
                  <div style={{ fontSize: '0.8125rem' }}>
                    <b style={{ fontSize: '0.875rem' }}>{group.houseName}</b>
                    {group.rep ? (
                      <span style={{ ...muted, marginLeft: '0.4rem' }}>
                        · {group.rep.name} <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#0f766e', background: '#ccfbf1', borderRadius: 6, padding: '0 0.4rem' }}>Job accounts</span>
                        {group.rep.email ? ` · ${group.rep.email}` : ' · no email on file'}
                        {group.rep.phone ? ` · ${group.rep.phone}` : ' · no phone on file'}
                      </span>
                    ) : (
                      <span style={{ ...muted, marginLeft: '0.4rem' }}>· no job-accounts rep with an email on file · add one on Materials → Supply houses → {group.houseName} → Contacts</span>
                    )}
                  </div>
                  {group.rep?.email && canEmail.length > 0 && !composing ? (
                    <button type="button" style={primaryBtn} onClick={() => openCompose(group)} data-testid="lens-ask-rep">
                      {askRepLabel(group.rep.name, canEmail.length)}
                    </button>
                  ) : null}
                </div>
                {!narrowViewport640 ? (
                  <div style={{ display: 'flex', gap: '0.75rem', padding: '0.25rem 0.65rem', fontSize: '0.66rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                    {composing ? <span style={{ width: 15 }} /> : null}
                    <span style={c1}>First parts run</span>
                    <span style={c2}>Job · property</span>
                    <span style={c3}>Missing at {group.houseName}</span>
                    <span style={c4} />
                  </div>
                ) : null}
                {group.rows.map((r) => {
                  const tone = startTone(r.daysUntilStart)
                  const emailable = r.job != null && r.state === 'none'
                  return (
                    <div key={r.key} style={rowStyle} data-testid="lens-row">
                      {composing ? (
                        <input type="checkbox" checked={compose?.ticked.has(r.key) ?? false} disabled={!emailable} onChange={() => toggle(r.key)} aria-label={`Include ${r.projectName} in the email`} title={emailable ? undefined : r.job ? 'Already asked — not in this email' : 'Joins once its job exists'} />
                      ) : null}
                      <span style={{ ...c1, color: toneColor(tone) }} title={r.startDate ? `First parts run ${r.startDate}` : 'No start date on the bid'}>
                        {describeStart(r.daysUntilStart)}
                        {r.daysUntilStart == null && r.wonDate ? <span style={{ ...muted, fontWeight: 400 }}> · won {shortDate(r.wonDate)}</span> : null}
                      </span>
                      <span style={c2}>
                        {r.job ? <span style={jobPill}>{effectiveJobLedgerNumber(r.job.hcpNumber, r.job.clickNumber) || '—'}</span> : <span style={noneChip}>no job yet</span>} <b>{r.projectName}</b>
                        <div style={muted}>
                          {r.bidLabel}
                          {r.gcName ? ` · ${r.gcName}` : ''}
                          {r.estimatorName ? ` · bid by ${r.estimatorName}` : ''}
                        </div>
                      </span>
                      <span style={c3}>
                        {!r.job ? (
                          <span style={muted}>after the job is opened{r.quoted ? ` · ${r.houseName} quoted` : ''}</span>
                        ) : r.state === 'requested' ? (
                          <>
                            <span style={requestedChip}>{r.houseName} · asked</span>
                            <span style={muted}>
                              {shortDate(r.requestedAt) ? `${shortDate(r.requestedAt)} · ` : ''}
                              {r.rep ? `${r.rep.name} opens them` : 'waiting on the house'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={noneChip}>{r.houseName}</span>
                            <span style={muted}>{r.quoted ? 'none yet · quoted this bid' : 'expects one per property'}</span>
                          </>
                        )}
                      </span>
                      <span style={c4}>{rowActions(r)}</span>
                    </div>
                  )
                })}
                {composing && composeGroup ? (
                  <div style={{ ...card, marginTop: '0.5rem', boxShadow: '0 20px 50px rgba(20,30,26,0.14)' }} data-testid="lens-compose">
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      {askRepLabel(rep?.name ?? null, tickedRows.length)}{' '}
                      <span style={{ ...muted, fontWeight: 400 }}>
                        · {composeGroup.houseName} · {tickedRows.length} propert{tickedRows.length === 1 ? 'y' : 'ies'} ticked · from your inbox
                      </span>
                    </div>
                    {!rep?.email ? null : !ready ? (
                      <p style={{ margin: 0, ...muted }}>Loading…</p>
                    ) : email ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8125rem', lineHeight: 1.45, padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', color: 'var(--text-700)' }} data-testid="lens-email">
                        <b>To:</b> {rep.name} · {rep.email}
                        {'\n'}<b>Subject:</b> {email.subject}
                        {'\n\n'}{email.text}
                      </pre>
                    ) : (
                      <p style={{ margin: 0, ...muted }}>Tick at least one property.</p>
                    )}
                    {composeRows.length < group.rows.length ? (
                      <p style={{ margin: 0, ...muted }}>
                        Rows already asked about, and won bids with no job yet, are left out — they join once the house answers or the job exists.
                      </p>
                    ) : null}
                    {compose?.stage === 'compose' ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setCompose(null)} style={ghostBtn}>Cancel</button>
                        <button type="button" onClick={() => void copy()} style={smallBtn} disabled={!email}>Copy for email</button>
                        {mailto && !tooLong ? (
                          <a href={mailto} onClick={() => setCompose((c) => (c ? { ...c, stage: 'confirm' } : c))} style={{ ...primaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Email from my inbox</a>
                        ) : (
                          <button type="button" onClick={() => void copy()} style={primaryBtn} disabled={!email}>Copy for email</button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8125rem' }}>The app can't see your inbox — send it there, then tell it here so each job reads <b>requested</b> at {composeGroup.houseName}.</div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button type="button" disabled={busy} onClick={() => setCompose((c) => (c ? { ...c, stage: 'compose' } : c))} style={ghostBtn}>Didn't send it</button>
                          <button type="button" disabled={busy} onClick={() => void logAll()} style={{ ...primaryBtn, background: '#16a34a', borderColor: '#16a34a' }} data-testid="lens-log-all">
                            {busy ? 'Logging…' : tickedRows.length === 2 ? 'Sent — log both' : tickedRows.length === 1 ? 'Sent — log it' : `Sent — log all ${tickedRows.length}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
      {sheet && sheet.row.job ? (
        <MarkJobAccountOpenedModal
          jobId={sheet.row.job.id}
          jobLabel={jobLabelOf(sheet.row)}
          house={{ id: sheet.row.houseId, name: sheet.row.houseName }}
          existing={null}
          reps={sheet.row.rep ? [{ id: sheet.row.rep.id, name: sheet.row.rep.name, email: sheet.row.rep.email ?? '', phone: sheet.row.rep.phone }] : []}
          initialMode={sheet.mode}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null)
            strips.reload()
          }}
        />
      ) : null}
    </div>
  )
}
