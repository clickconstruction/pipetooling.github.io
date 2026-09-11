import { useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { budgetWhyWords, componentBurn, spendByComponent, type ResolvedJobBudget } from '../../lib/jobs/jobBudget'
import type { JobBudgetState, SuggestedBid } from '../../hooks/useJobBudget'
import type { JobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'

/**
 * The Budget card on the job's Costs tab (Burn against the bid, PR 2 — v2.3299).
 *
 * Frame A — a job with a budget: the source line first (◆ from bid B66 · bid value
 * vs the job price · taken when · how complete), then one row per component —
 * labor in HOURS first (the bid priced a book rate, the job pays real wages),
 * materials, subs, other — each with used vs budget, the % done as a marker on
 * the bar, and where it lands at today's pace; then the "why" sentence.
 *
 * Frame B — no budget: the doorway. Burn is reading an assumption (price × (1 −
 * target)); the ranked candidates (price equal to a bid value · same GC and won ·
 * same address) with one-tap Link, a bid-number search, and the typed form
 * (hours · materials · subs). Nothing links on its own.
 */

const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const h0 = (n: number) => `${Math.round(n).toLocaleString('en-US')} h`

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', background: 'var(--surface)', display: 'grid', gap: '0.55rem' }
const chip = (tone: 'ok' | 'warn' | 'bad' | 'muted' | 'blue'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: '0.7rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  border: `1px solid ${tone === 'ok' ? '#16a34a' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#dc2626' : tone === 'blue' ? '#2563eb' : 'var(--border)'}`,
  color: tone === 'ok' ? 'var(--text-green-700)' : tone === 'warn' ? 'var(--text-amber-700)' : tone === 'bad' ? 'var(--text-red-700)' : tone === 'blue' ? 'var(--text-blue-700)' : 'var(--text-muted)',
})
const btn = (primary = false): CSSProperties => ({
  padding: '0.3rem 0.7rem',
  fontSize: '0.78rem',
  fontWeight: 600,
  border: `1px solid ${primary ? '#3b82f6' : 'var(--border-strong)'}`,
  borderRadius: 6,
  background: primary ? '#3b82f6' : 'var(--surface)',
  color: primary ? 'white' : 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-blue-700)', cursor: 'pointer', font: 'inherit', fontWeight: 600 }
const numInput: CSSProperties = { width: '7rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', fontSize: '0.8rem', textAlign: 'right' }

export type JobBudgetCardProps = {
  jobId: string
  jobLabel: string
  priceUsd: number | null
  /** Job % done as Burn reads it (report %, else the job's fallback). */
  pctDone: number | null
  inputs: JobChargesTimelineInputs | null
  budget: JobBudgetState
  resolved: ResolvedJobBudget
  /** The company crew rate for a typed budget's labor dollars (null = hours only). */
  companyRate: number | null
  canWrite: boolean
  currentUserId: string | null
  /** The bid already on the job (jobs_ledger.bid_id), for "take its estimate". */
  linkedBid: { id: string; bid_number: string | null; project_name: string | null } | null
}

type Row = { key: string; label: string; sub: string; usedUsd: number; usedHours?: number; budgetUsd: number | null; budgetHours?: number | null; footing: 'bid' | 'typed' | 'assumed' | 'none' }

export function JobBudgetCard(p: JobBudgetCardProps) {
  const [typedOpen, setTypedOpen] = useState(false)
  const [hours, setHours] = useState('')
  const [materials, setMaterials] = useState('')
  const [subs, setSubs] = useState('')
  const [findQ, setFindQ] = useState('')
  const [findRows, setFindRows] = useState<SuggestedBid[] | null>(null)
  const [finding, setFinding] = useState(false)

  const spend = useMemo(() => spendByComponent(p.inputs?.chargeEvents ?? []), [p.inputs?.chargeEvents])
  const r = p.resolved
  const c = r.components

  const rows: Row[] = useMemo(() => {
    const f = r.source === 'assumed' ? 'none' : r.source
    return [
      { key: 'labor', label: 'Labor', sub: 'hours first — wages differ from the bid rate', usedUsd: spend.teamUsd, usedHours: p.inputs?.teamHours ?? 0, budgetUsd: c && c.laborUsd > 0 ? c.laborUsd : null, budgetHours: c && c.laborHours > 0 ? c.laborHours : null, footing: c && c.laborHours > 0 ? f : 'none' },
      { key: 'materials', label: 'Materials', sub: 'parts · supply-house invoices · cards', usedUsd: spend.partsUsd, budgetUsd: c && c.materialsUsd > 0 ? c.materialsUsd : null, footing: c && c.materialsUsd > 0 ? f : 'none' },
      { key: 'subs', label: 'Subs', sub: 'sub labor sheets', usedUsd: spend.subUsd, budgetUsd: c && c.subsUsd > 0 ? c.subsUsd : null, footing: c && c.subsUsd > 0 ? f : 'none' },
      { key: 'other', label: 'Other', sub: 'permits · equipment · driving · travel', usedUsd: 0, budgetUsd: c && c.otherUsd > 0 ? c.otherUsd : null, footing: c && c.otherUsd > 0 ? f : 'none' },
    ]
  }, [r.source, c, spend, p.inputs?.teamHours])

  const why = useMemo(
    () =>
      budgetWhyWords({
        labor: componentBurn({ usedUsd: spend.teamUsd, budgetUsd: c && c.laborUsd > 0 ? c.laborUsd : null, pctDone: p.pctDone }),
        materials: componentBurn({ usedUsd: spend.partsUsd, budgetUsd: c && c.materialsUsd > 0 ? c.materialsUsd : null, pctDone: p.pctDone }),
        subs: componentBurn({ usedUsd: spend.subUsd, budgetUsd: c && c.subsUsd > 0 ? c.subsUsd : null, pctDone: p.pctDone }),
        pctDone: p.pctDone,
        fmt: (n) => Math.round(n).toLocaleString('en-US'),
      }),
    [spend, c, p.pctDone],
  )

  const findBids = async () => {
    const q = findQ.trim()
    if (!q) return
    setFinding(true)
    const digits = q.replace(/^[a-z]+/i, '')
    const { data } = await supabase.from('bids').select('id, bid_number, project_name, bid_value, agreed_value, outcome, customers(name)').or(`bid_number.ilike.%${digits || q}%,project_name.ilike.%${q}%`).limit(5)
    setFindRows(
      ((data ?? []) as Array<{ id: string; bid_number: string | null; project_name: string | null; bid_value: number | null; agreed_value: number | null; outcome: string | null; customers: { name: string | null } | { name: string | null }[] | null }>).map((b) => ({
        bid_id: b.id,
        bid_number: b.bid_number,
        project_name: b.project_name,
        bid_value: b.bid_value != null ? Number(b.bid_value) : null,
        agreed_value: b.agreed_value != null ? Number(b.agreed_value) : null,
        outcome: b.outcome,
        customer_name: Array.isArray(b.customers) ? (b.customers[0]?.name ?? null) : (b.customers?.name ?? null),
        rank: 9,
        reason: 'found by number or name',
        has_estimate: false,
        estimate_hours: 0,
        linked_jobs: 0,
      })),
    )
    setFinding(false)
  }

  const submitTyped = async () => {
    const hrs = Math.max(0, parseFloat(hours) || 0)
    const mat = Math.max(0, parseFloat(materials) || 0)
    const sub = Math.max(0, parseFloat(subs) || 0)
    if (hrs === 0 && mat === 0 && sub === 0) return
    const ok = await p.budget.setTyped({ laborHours: hrs, laborRate: p.companyRate, materialsUsd: mat, subsUsd: sub })
    if (ok) setTypedOpen(false)
  }

  const bidChip = (b: SuggestedBid) => (
    <div key={b.bid_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', padding: '0.4rem 0', borderTop: '1px solid var(--border)' }} data-testid="budget-candidate">
      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
        <b>B{b.bid_number ?? '?'} {b.project_name ?? ''}</b>{' '}
        <span style={chip(b.outcome === 'won' || b.outcome === 'started_or_complete' ? 'ok' : 'muted')}>{b.outcome ?? 'no outcome'}</span>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {b.bid_value != null ? `${usd0(b.bid_value)} bid value` : 'no bid value'}
          {b.agreed_value != null ? ` · ${usd0(b.agreed_value)} agreed` : ''}
          {b.customer_name ? ` · ${b.customer_name}` : ''}
          {' · '}
          {b.reason}
          {b.has_estimate ? (b.estimate_hours > 0 ? ` · estimate with ${h0(b.estimate_hours)}` : ' · estimate without hours') : ' · no cost estimate'}
          {b.linked_jobs > 0 ? ` · already on ${b.linked_jobs} job${b.linked_jobs === 1 ? '' : 's'}` : ''}
        </div>
      </div>
      {p.canWrite ? (
        <button type="button" onClick={() => void p.budget.linkAndSnapshot(b.bid_id)} disabled={p.budget.busy} style={btn(true)}>
          Link this bid
        </button>
      ) : null}
    </div>
  )

  // ---------------------------------------------------------------- Frame A
  if (r.source !== 'assumed') {
    const bd = p.budget.linkedBreakdown
    const bidValue = bd?.agreed_value ?? bd?.bid_value ?? null
    const priceMatch = bidValue != null && p.priceUsd != null ? Math.abs(bidValue - p.priceUsd) <= 1 : null
    const taken = r.takenAt ? new Date(r.takenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
    const comp = r.completeness
    return (
      <div style={card} data-testid="job-budget-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem 0.6rem', flexWrap: 'wrap' }}>
          <b style={{ fontSize: '0.9375rem' }}>
            {r.glyph} {r.source === 'bid' ? `Budget from bid${bd?.bid_number ? ` B${bd.bid_number}` : ''}` : 'Typed budget'}
          </b>
          {r.source === 'bid' && bidValue != null ? (
            <span style={chip(priceMatch === false ? 'warn' : 'ok')}>
              bid {usd0(bidValue)} {priceMatch === true ? '= job price' : priceMatch === false ? `≠ job price ${p.priceUsd != null ? usd0(p.priceUsd) : '—'}` : ''}
            </span>
          ) : null}
          {taken ? <span style={chip('muted')}>{r.source === 'bid' ? 'estimate taken' : 'typed'} {taken}{p.currentUserId && r.takenBy === p.currentUserId ? ' · by you' : ''}</span> : null}
          {r.source === 'bid' && comp ? (
            comp.usable ? (
              <span style={chip('ok')}>estimate complete</span>
            ) : (
              <>
                {comp.rows_total > 0 && comp.rows_with_hours < comp.rows_total ? <span style={chip('warn')}>{comp.rows_total - comp.rows_with_hours} row{comp.rows_total - comp.rows_with_hours === 1 ? '' : 's'} without hours</span> : null}
                {!comp.rate_set ? <span style={chip('warn')}>no labor rate on the bid</span> : null}
                {comp.rows_total === 0 ? <span style={chip('bad')}>no hours on the bid</span> : null}
              </>
            )
          ) : null}
          {r.source === 'bid' && comp ? <span style={chip('muted')}>materials {comp.materials_source === 'po' ? 'from POs' : comp.materials_source === 'takeoff' ? 'from takeoff' : 'none'}</span> : null}
          {r.note ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>“{r.note}”</span> : null}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.4rem' }}>
            {p.canWrite && r.source === 'bid' && r.bidId ? (
              <button type="button" onClick={() => void p.budget.linkAndSnapshot(r.bidId!)} disabled={p.budget.busy} style={btn()} title="Take the bid's estimate again — repricing shows as a visible change, never a silent drift">
                Refresh from bid ↻
              </button>
            ) : null}
            {p.canWrite && r.source === 'typed' ? (
              <button type="button" onClick={() => { setHours(c ? String(c.laborHours || '') : ''); setMaterials(c ? String(c.materialsUsd || '') : ''); setSubs(c ? String(c.subsUsd || '') : ''); setTypedOpen((v) => !v) }} style={btn()}>
                Edit
              </button>
            ) : null}
            {p.canWrite ? (
              <button type="button" onClick={() => void p.budget.clear()} disabled={p.budget.busy} style={btn()} title="Back to the assumption (price × (1 − target)); the bid link stays">
                Clear
              </button>
            ) : null}
          </span>
        </div>
        {typedOpen ? typedForm() : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)', gap: '0.25rem 0.6rem', fontSize: '0.78rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Where it goes</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Used</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Budget</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Burn · marker = % done</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>At completion</div>
          {rows.map((row) => {
            const b = componentBurn({ usedUsd: row.usedUsd, budgetUsd: row.budgetUsd, pctDone: p.pctDone })
            const fill = b.pct != null ? Math.min(b.pct, 130) : 0
            const over = b.overUsd != null && b.overUsd > 0
            return (
              <div key={row.key} style={{ display: 'contents' }} data-testid={`budget-row-${row.key}`}>
                <div>
                  <div style={{ fontWeight: 600 }}>{row.label}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{row.sub}</div>
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.usedHours != null ? <div>{h0(row.usedHours)}</div> : null}
                  <div style={{ color: row.usedHours != null ? 'var(--text-muted)' : undefined }}>{usd0(row.usedUsd)}</div>
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.budgetHours != null ? <div>{h0(row.budgetHours)}</div> : null}
                  <div style={{ color: row.footing === 'none' ? 'var(--text-muted)' : row.usedHours != null ? 'var(--text-muted)' : undefined }}>
                    {row.budgetUsd != null ? `${usd0(row.budgetUsd)}${row.key === 'labor' && c?.laborRate ? ` @ $${formatCurrency(c.laborRate)}` : ''}` : row.footing === 'none' ? '≈ assumed' : '—'}
                  </div>
                </div>
                <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--bg-200)', overflow: 'hidden' }} title={b.pct != null ? `${Math.round(b.pct)} % of the budget used` : 'no budget for this component'}>
                  <div style={{ position: 'absolute', inset: 0, width: `${Math.min(fill, 100)}%`, background: over ? '#dc2626' : '#2563eb', opacity: 0.8 }} />
                  {p.pctDone != null ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(p.pctDone, 100)}%`, width: 2, background: '#f59e0b' }} /> : null}
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: over ? 'var(--text-red-700)' : undefined }}>
                  {b.atCompletionUsd != null ? usd0(b.atCompletionUsd) : '—'}
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-700)' }} data-testid="budget-why">
          <b>Why: </b>
          {why}
          {r.partial && !(r.partial.materials && r.partial.subs) ? <span style={{ color: 'var(--text-muted)' }}> Components without a figure on the {r.source === 'bid' ? 'bid' : 'typed budget'} burn against the assumption.</span> : null}
        </p>
        {p.budget.error ? <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{p.budget.error}</p> : null}
      </div>
    )
  }

  // ---------------------------------------------------------------- Frame B
  function typedForm() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', fontSize: '0.8rem', padding: '0.5rem 0.6rem', border: '1px dashed var(--border-strong)', borderRadius: 8 }} data-testid="budget-typed-form">
        <span style={{ color: 'var(--text-muted)' }}>{r.source === 'assumed' ? 'or type a budget:' : 'typed budget:'}</span>
        <label>
          hours <input type="number" min={0} step={1} value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Budget labor hours" style={numInput} />
        </label>
        <label>
          materials $ <input type="number" min={0} step={100} value={materials} onChange={(e) => setMaterials(e.target.value)} aria-label="Budget materials dollars" style={numInput} />
        </label>
        <label>
          subs $ <input type="number" min={0} step={100} value={subs} onChange={(e) => setSubs(e.target.value)} aria-label="Budget subs dollars" style={numInput} />
        </label>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.companyRate != null ? `hours at the company rate $${formatCurrency(p.companyRate)}/h` : 'hours only — no company rate yet'}</span>
        <button type="button" onClick={() => void submitTyped()} disabled={p.budget.busy || !p.canWrite} style={btn(true)}>
          Use this budget
        </button>
      </div>
    )
  }

  const assumedWords = r.directUsd != null && r.targetMarginPct != null ? `price × ${100 - r.targetMarginPct} % (${r.targetMarginPct} % target) = ${usd0(r.directUsd)}` : 'no job price yet'
  const linked = p.linkedBid
  const bd = p.budget.linkedBreakdown
  return (
    <div style={{ ...card, borderColor: '#f59e0b', background: 'var(--bg-amber-100)' }} data-testid="job-budget-banner">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem 0.6rem', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.9375rem' }}>≈ Burn is reading an assumed budget</b>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>{assumedWords}.{linked ? '' : ' No bid is linked to this job.'}</span>
      </div>
      {linked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', fontSize: '0.8rem' }} data-testid="budget-linked-no-snapshot">
          <span>
            Linked to <b>B{linked.bid_number ?? '?'} {linked.project_name ?? ''}</b>
            {bd ? (bd.has_estimate ? (bd.labor_hours > 0 ? ` · estimate with ${h0(bd.labor_hours)}${bd.completeness?.rate_set ? '' : ', no labor rate'} · ${usd0(bd.total_direct_usd)} direct` : ' · estimate without hours') : ' · no cost estimate yet') : ''}
          </span>
          {p.canWrite ? (
            <button type="button" onClick={() => void p.budget.linkAndSnapshot(linked.id)} disabled={p.budget.busy} style={btn(true)}>
              Take its estimate as the budget
            </button>
          ) : null}
          {bd && !bd.has_estimate ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Linking pays even so — cost the bid on its Labor tab and press this again.</span> : null}
        </div>
      ) : (
        <>
          {p.budget.loading ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Looking for the bid…</span> : null}
          {p.budget.candidates.length > 0 ? (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                {p.budget.candidates.length === 1 ? 'One bid matches this job:' : `${p.budget.candidates.length} bids could be this job's:`}
              </div>
              {p.budget.candidates.map(bidChip)}
            </div>
          ) : !p.budget.loading ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No bid matches this job's price, GC or address.</span>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <input type="text" value={findQ} onChange={(e) => setFindQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void findBids() }} placeholder="Find another bid — number or name" aria-label="Find another bid" style={{ ...numInput, width: '16rem', textAlign: 'left' }} />
            <button type="button" onClick={() => void findBids()} disabled={finding} style={btn()}>
              {finding ? 'Finding…' : 'Find'}
            </button>
            {findRows && findRows.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>nothing by that number or name</span> : null}
          </div>
          {findRows && findRows.length > 0 ? <div>{findRows.map(bidChip)}</div> : null}
        </>
      )}
      {p.canWrite ? (typedOpen ? typedForm() : <button type="button" onClick={() => setTypedOpen(true)} style={{ ...linkBtn, fontSize: '0.8rem', justifySelf: 'start' }}>or type a budget…</button>) : null}
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Linking stamps the job with the bid and takes a snapshot of its estimate; a bid without an estimate still lands the bid value and the bid → job trail. Three typed numbers from the person who scoped the job beat the target rule.</p>
      {p.budget.error ? <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{p.budget.error}</p> : null}
    </div>
  )
}

export default JobBudgetCard
