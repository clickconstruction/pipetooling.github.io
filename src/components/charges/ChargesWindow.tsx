import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { formatErrorMessage } from '../../utils/errorHandling'
import { buildJobCharges, type JobCharges } from '../../lib/charges/jobCharges'
import { addChargeAdjustments, loadJobCharges, revertChargeAdjustments, saveJobChargeRule, type JobChargesReadResult, type NewChargeAdjustment } from '../../lib/charges/jobChargesRead'
import { chargeAdjustmentWords, saveAdjustmentsLabel, type ChargeAdjustment } from '../../lib/charges/adjustments'
import { jobChargeRuleWords, officeNotes, type CrewDay, type JobChargeRule } from '../../lib/charges/crewDays'
import { CREW_SHAPES, CREW_SHAPE_LOWER, CREW_SHAPE_WORDS, crewRateWords, crewRateFor, type CrewShape } from '../../lib/charges/rateCard'
import { MaterialsMarkupPair } from './MaterialsMarkupPair'
import { Money } from './Money'
import { premiumWaitsWords } from '../../lib/charges/premium'
import { UnchargedCallout } from './UnchargedCallout'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

/**
 * The Charges window (punch list #254, PR 3): behind a Charges cell on the Job Summary. The job's rule and markup at
 * the top, which write to the job; four tiles — labor, materials, charges, the stand against the revenue — each as
 * the record and with the adjustments in hand; every crew-day by week with a tick to keep it and its shape as a
 * chip the office can change, the reason under it; the material lines with a tick and Pass through; the adjustments
 * log; Revert to the record and Save N adjustments. Adjustments live on the job, never on a session or an invoice.
 */

export type ChargesWindowViewer = { userId: string; role: string | null; canAccessPay: boolean }

type Props = { jobId: string; viewer: ChargesWindowViewer; onClose: () => void; onChanged?: () => void; zIndex?: number }

const field: CSSProperties = { padding: '0.35rem 0.5rem', fontSize: '0.875rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const label: CSSProperties = { display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', fontWeight: 600 }
/** A dead press reads the dead pair, blue or grey alike. */
const dead: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'transparent', cursor: 'not-allowed' }
const chip: CSSProperties = { padding: '0.15rem 0.45rem', fontSize: '0.8125rem', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', cursor: 'pointer' }
const th: CSSProperties = { textAlign: 'left', padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }
const td: CSSProperties = { padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', verticalAlign: 'top' }
const num: CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' }

/** `Sat Apr 25` from a YYYY-MM-DD, with no time zone in the way. */
export function dayWords(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function weekWords(monday: string): string {
  const [y, m, d] = monday.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  return `Week of ${dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`
}

type Pending = NewChargeAdjustment & { key: string }

function pendingKey(kind: NewChargeAdjustment['kind'], target: string): string {
  return `${kind}:${target}`
}

/** The office's pending changes read as adjustments, so the kernels price them before they are saved. */
function pendingAsAdjustments(jobId: string, pending: ReadonlyArray<Pending>): ChargeAdjustment[] {
  const now = new Date().toISOString()
  return pending.map((p) => ({ id: `pending:${p.key}`, jobId, kind: p.kind, target: p.target, shape: p.shape, amount: p.amount, reason: p.reason, madeByName: 'you', madeAt: now }))
}

export function canAdjustCharges(viewer: ChargesWindowViewer): boolean {
  return viewer.role === 'dev' || viewer.role === 'controller' || (viewer.role === 'master_technician' && viewer.canAccessPay)
}

export default function ChargesWindow({ jobId, viewer, onClose, onChanged, zIndex = 1300 }: Props) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const narrow = useMatchMedia('(max-width: 860px)')
  const titleId = useId()
  const [read, setRead] = useState<JobChargesReadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const editable = canAdjustCharges(viewer) && !read?.adjustmentsError

  const load = useCallback(async () => {
    setReading(true)
    setError(null)
    try {
      setRead(await loadJobCharges(jobId))
    } catch (e) {
      setError(formatErrorMessage(e, 'The job’s charges could not be read.'))
    } finally {
      setReading(false)
    }
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const charges: JobCharges | null = useMemo(() => {
    if (!read) return null
    return buildJobCharges({ ...read.input, adjustments: [...read.adjustments, ...pendingAsAdjustments(jobId, pending)] })
  }, [read, pending, jobId])

  function setPendingFor(kind: NewChargeAdjustment['kind'], target: string, shape: CrewShape | null, on: boolean, amount: number | null = null) {
    const key = pendingKey(kind, target)
    setPending((prev) => {
      const rest = prev.filter((p) => p.key !== key)
      return on ? [...rest, { key, kind, target, shape, amount, reason: '' }] : rest
    })
  }

  function setReason(key: string, reason: string) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, reason } : p)))
  }

  async function runWrite(key: string, write: () => Promise<void>, success: string) {
    setBusy(key)
    try {
      await write()
      showToast(success, 'success')
      onChanged?.()
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The change could not be saved.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function saveRule(rule: JobChargeRule, markupPct: number | null) {
    await runWrite('rule', () => saveJobChargeRule(jobId, rule, markupPct), `The job charges its labor as ${jobChargeRuleWords(rule)}.`)
  }

  async function saveAdjustments() {
    if (!pending.length) return
    const rows = pending
    await runWrite('save', () => addChargeAdjustments(jobId, rows, viewer.userId), rows.length === 1 ? 'The adjustment is saved.' : `${rows.length} adjustments are saved.`)
    setPending([])
  }

  async function revertAll() {
    const saved = read?.adjustments.length ?? 0
    if (!saved && !pending.length) return
    const ok = await confirmDialog({
      message: saved ? `Revert this job's charges to the record? ${saved === 1 ? 'The saved adjustment is' : `${saved} saved adjustments are`} stamped reverted and stay in the log.` : 'Drop the adjustments you have not saved?',
      confirmLabel: 'Revert',
    })
    if (!ok) return
    setPending([])
    if (saved) await runWrite('revert', () => revertChargeAdjustments(jobId, viewer.userId), 'The job’s charges read the record again.')
  }

  const title = read ? `Charges · ${read.job.number} · ${read.job.name}` : 'Charges'
  const card = read?.input.card
  const rule = read?.rule ?? { kind: 'crew' as const }
  const markupInForce = read ? (read.jobMarkupPct ?? read.input.card.materialsMarkupPct) : null
  const pendingByKey = new Map(pending.map((p) => [p.key, p] as const))

  function shapeValueFor(day: CrewDay): string {
    const p = pendingByKey.get(pendingKey('day_shape', day.workDate))
    if (p?.shape) return p.shape
    return day.adjusted && day.pricedShape ? day.pricedShape : ''
  }

  const weeks = useMemo(() => {
    if (!charges) return []
    const byWeek = new Map<string, CrewDay[]>()
    for (const w of charges.weeks) byWeek.set(w.weekStart, [])
    for (const d of charges.days) {
      const w = charges.weeks.find((x) => x.weekStart <= d.workDate && d.workDate < addDays(x.weekStart, 7))
      if (w) byWeek.get(w.weekStart)!.push(d)
    }
    return charges.weeks.map((w) => ({ week: w, days: byWeek.get(w.weekStart) ?? [] }))
  }, [charges])

  const lineLabel = (id: string) => read?.input.lines.find((l) => l.id === id)?.label ?? id

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(2vh + var(--app-top-chrome, 0px)) 0.75rem 2vh', overflowY: 'auto' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="charges-window" style={{ width: 'min(1200px, 100%)', maxHeight: 'min(96vh, 100%)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 18px 48px rgba(17,24,39,0.25)', color: 'var(--text-base)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '0.75rem', rowGap: '0.1rem' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', flex: '1 1 12rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </h2>
          {read ? (
            <span style={{ ...quiet, whiteSpace: 'nowrap' }}>
              Revenue on the bills <Money amount={read.job.revenue} data-testid="charges-revenue" />
            </span>
          ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '1.1rem', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {error ? (
          <div style={{ padding: '1rem', display: 'grid', gap: '0.5rem', justifyItems: 'start' }}>
            <p style={{ ...quiet, color: 'var(--text-red-600)' }} data-testid="charges-error">{error}</p>
            <button type="button" style={btn} onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : !read || !charges || !card ? (
          <p style={{ ...quiet, padding: '1rem' }}>{reading ? 'Reading the job’s hours and materials…' : ''}</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.9rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <label style={{ ...label, flex: '1 1 16rem', minWidth: 0, maxWidth: 420 }}>
                Charge this job’s labor as
                <select
                  value={rule.kind === 'shape' ? `shape:${rule.shape}` : rule.kind}
                  disabled={!editable || busy != null}
                  aria-label="Charge this job’s labor as"
                  data-testid="charges-rule"
                  style={{ ...field, width: '100%', minWidth: 0 }}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'crew') void saveRule({ kind: 'crew' }, read.jobMarkupPct)
                    else if (v === 'flat') void saveRule({ kind: 'flat', rate: rule.kind === 'flat' ? rule.rate : (card.rates.master_helper ?? 0) }, read.jobMarkupPct)
                    else if (v.startsWith('shape:')) void saveRule({ kind: 'shape', shape: v.slice(6) as CrewShape }, read.jobMarkupPct)
                  }}
                >
                  <option value="crew">the crew on each day, from the rate card</option>
                  {CREW_SHAPES.map((s) => (
                    <option key={s} value={`shape:${s}`}>
                      {CREW_SHAPE_LOWER[s]} throughout · {crewRateWords(crewRateFor(card, s, 0))}
                    </option>
                  ))}
                  <option value="flat">a flat rate for every hour</option>
                </select>
              </label>
              {rule.kind === 'flat' ? (
                <label style={label}>
                  Flat rate, dollars an hour
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={rule.rate || ''}
                    disabled={!editable || busy != null}
                    aria-label="Flat rate, dollars an hour"
                    style={{ ...field, width: 120 }}
                    onBlur={(e) => {
                      const n = Number(e.target.value)
                      if (Number.isFinite(n) && n > 0 && n !== rule.rate) void saveRule({ kind: 'flat', rate: Math.round(n * 100) / 100 }, read.jobMarkupPct)
                    }}
                  />
                </label>
              ) : null}
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <span style={label}>Markup on materials{read.jobMarkupPct == null ? (markupInForce != null ? ' · the company’s' : ' · none, at cost') : ' · this job’s own'}</span>
                <MaterialsMarkupPair
                  compact
                  markupPct={read.jobMarkupPct}
                  companyMarkupPct={card.materialsMarkupPct}
                  disabled={!editable || busy != null}
                  testId="charges-markup"
                  onCommit={(n) => {
                    if (n !== read.jobMarkupPct) void saveRule(rule, n)
                  }}
                />
              </div>
              <p style={{ ...quiet, marginLeft: 'auto', maxWidth: 420, lineHeight: 1.4 }}>These two write to the job. Everything below them is the record, line by line, with the adjustments on top.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '0.6rem', padding: '0.75rem 1rem' }} data-testid="charges-tiles">
              <Tile label="Labor" amount={charges.totals.labor} record={charges.record.totals.labor} sub={`${charges.totals.crewHours.toLocaleString('en-US', { maximumFractionDigits: 2 })} crew h · ${charges.totals.days} days${charges.totals.unpricedDays ? ` · ${charges.totals.unpricedDays} not priced` : ''}`} testId="tile-labor" />
              <Tile label="Materials" amount={charges.totals.materials} record={charges.record.totals.materials} sub={`${charges.materials.totals.lines} lines · ${charges.materials.markupPct != null ? `${charges.materials.markupPct}% over cost` : 'at cost'}${charges.materials.totals.passedThrough ? ` · ${charges.materials.totals.passedThrough} passed through` : ''}`} testId="tile-materials" />
              <Tile label="Charges" amount={charges.totals.charges} record={charges.record.totals.charges} sub="labor and materials" accent testId="tile-charges" />
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', display: 'grid', gap: 2 }} data-testid="tile-premium">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Against the revenue</span>
                {charges.totals.unpricedDays > 0 ? (
                  <>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-muted)' }}>Not yet</span>
                    <span style={quiet}>{premiumWaitsWords(charges.totals.unpricedDays)}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: charges.premium.kind === 'shortfall' ? 'var(--text-red-600)' : 'var(--text-strong)' }}>{charges.premium.kind === 'even' ? 'even' : <><Money amount={charges.premium.amount} /> {charges.premium.kind}</>}</span>
                    <span style={quiet}>{charges.adjustmentsCount ? `the record reads ${charges.record.premium.words}` : charges.premium.sentence}</span>
                  </>
                )}
              </div>
            </div>
            <UnchargedCallout people={charges.uncharged} unchargedDays={charges.totals.unchargedDays} role={viewer.role} onNavigate={onClose} />
            {officeNotes(charges.notes, charges.uncharged).length ? (
              <ul style={{ margin: '0 1rem 0.5rem', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="charges-notes">
                {officeNotes(charges.notes, charges.uncharged).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}

            <div style={{ padding: '0 1rem 1rem', display: 'grid', gap: '1rem', overflow: 'auto', minHeight: 0, flex: 1 }}>
              <section style={{ display: 'grid', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }}>Labor · crew-days</h3>
                  <span style={quiet}>a tick keeps the day on the paper · the chip is the crew that day · the job’s rule: {jobChargeRuleWords(rule)}</span>
                </div>
                {charges.days.length === 0 ? (
                  <p style={quiet} data-testid="charges-no-days">No approved hours on this job in the clock. Approve the sessions in People → Hours and they price here.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="charges-days">
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 28 }} />
                        <th style={th}>Day</th>
                        <th style={th}>Who was out, hours each</th>
                        <th style={th}>The crew that day</th>
                        <th style={{ ...th, textAlign: 'right' }}>Crew hours</th>
                        <th style={{ ...th, textAlign: 'right' }}>Rate</th>
                        <th style={{ ...th, textAlign: 'right' }}>Charged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map(({ week, days }) => (
                        <WeekRows key={week.weekStart} weekStart={week.weekStart} days={days} editable={editable && busy == null} pendingByKey={pendingByKey} shapeValueFor={shapeValueFor} onShape={(d, v) => setPendingFor('day_shape', d.workDate, v ? (v as CrewShape) : null, Boolean(v))} onKeep={(d, keep) => setPendingFor('day_off', d.workDate, null, !keep)} onReason={setReason} />
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1fr) 380px', gap: '0.9rem', alignItems: 'start' }}>
                <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }}>Materials · {charges.materials.totals.lines + charges.materials.leftOff.length} lines</h3>
                    <span style={quiet}>a tick keeps the line · Pass through charges it at cost</span>
                  </div>
                  {read.input.lines.length === 0 ? (
                    <p style={quiet} data-testid="charges-no-lines">No supply-house invoice or tallied part on this job. Share an invoice to it from Parts, or tally a part, and it prices here.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="charges-lines">
                      <tbody>
                        {read.input.lines.map((l) => {
                          const offKey = pendingKey('line_off', l.id)
                          const passKey = pendingKey('line_pass_through', l.id)
                          const charged = charges.materials.lines.find((c) => c.id === l.id)
                          const savedOff = read.adjustments.some((a) => a.kind === 'line_off' && a.target === l.id)
                          const savedPass = read.adjustments.some((a) => a.kind === 'line_pass_through' && a.target === l.id)
                          const kept = !savedOff && !pendingByKey.has(offKey)
                          const passed = savedPass || pendingByKey.has(passKey)
                          return (
                            <tr key={l.id} style={{ opacity: kept ? 1 : 0.55 }}>
                              <td style={{ ...td, width: 28 }}>
                                <input type="checkbox" checked={kept} disabled={!editable || busy != null || savedOff} aria-label={`Keep ${l.label}`} onChange={(e) => setPendingFor('line_off', l.id, null, !e.target.checked, l.cost)} />
                              </td>
                              <td style={td}>
                                {l.label}
                                {l.dateKey ? <span style={{ ...quiet, display: 'block' }}>{l.dateKey}</span> : null}
                                {pendingByKey.has(offKey) || pendingByKey.has(passKey) ? (
                                  <input type="text" placeholder="Reason" aria-label={`Reason for ${l.label}`} style={{ ...field, marginTop: 4, width: '100%', maxWidth: 360 }} value={pendingByKey.get(offKey)?.reason ?? pendingByKey.get(passKey)?.reason ?? ''} onChange={(e) => { if (pendingByKey.has(offKey)) setReason(offKey, e.target.value); if (pendingByKey.has(passKey)) setReason(passKey, e.target.value) }} />
                                ) : null}
                              </td>
                              <td style={num}><Money amount={l.cost} /></td>
                              <td style={num}>{charged ? <Money amount={charged.charged} /> : <span style={quiet}>left off</span>}</td>
                              <td style={{ ...td, textAlign: 'right' }}>
                                <button type="button" style={{ ...chip, borderColor: passed ? 'var(--text-amber-700, var(--border-strong))' : 'var(--border)' }} disabled={!editable || busy != null || savedPass || !kept} onClick={() => setPendingFor('line_pass_through', l.id, null, !pendingByKey.has(passKey), l.cost)} aria-pressed={passed}>
                                  {passed ? 'At cost' : 'Pass through'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </section>

                <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.4rem' }} data-testid="charges-log">
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }}>Adjustments on this job</h3>
                  {read.adjustments.length === 0 && pending.length === 0 ? <p style={quiet}>Nothing adjusted. Every line is the record. Change a day’s crew, untick a day or a line, or pass a line through, and it lands here.</p> : null}
                  {pending.map((p) => (
                    <div key={p.key} style={{ padding: '0.35rem 0.5rem', borderLeft: '3px solid var(--text-amber-700, var(--border-strong))', background: 'var(--bg-subtle)', borderRadius: 4, fontSize: '0.8125rem' }}>
                      {chargeAdjustmentWords({ id: p.key, jobId, kind: p.kind, target: p.target, shape: p.shape, amount: p.amount, reason: p.reason, madeByName: null, madeAt: '' }, dayWords, lineLabel)}
                      <span style={{ ...quiet, display: 'block' }}>not saved yet{p.reason.trim() ? '' : ' · give it a reason'}</span>
                    </div>
                  ))}
                  {read.adjustments.map((a) => (
                    <div key={a.id} style={{ padding: '0.35rem 0.5rem', borderLeft: '3px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}>
                      {chargeAdjustmentWords(a, dayWords, lineLabel)}
                      {a.madeAt ? <span style={{ ...quiet, display: 'block' }}>{new Date(a.madeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span> : null}
                    </div>
                  ))}
                  <p style={{ ...quiet, lineHeight: 1.4 }}>Adjustments live on this job’s charges, never on anyone’s clock session or invoice. The Job Summary row and every statement made after read them.</p>
                </section>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <button type="button" style={{ ...btn, ...(!editable || busy != null || (read.adjustments.length === 0 && pending.length === 0) ? dead : {}) }} disabled={!editable || busy != null || (read.adjustments.length === 0 && pending.length === 0)} onClick={() => void revertAll()} data-testid="charges-revert">
                Revert to the record
              </button>
              {read.adjustmentsError ? <span style={quiet} data-testid="charges-adjustments-unavailable">Adjustments are not available: {read.adjustmentsError}</span> : !editable ? <span style={quiet}>Read only: a dev, the controller or a pay-approved master adjusts charges.</span> : null}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                style={{ ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff', ...(!editable || busy != null || pending.length === 0 || pending.some((p) => !p.reason.trim()) ? dead : {}) }}
                disabled={!editable || busy != null || pending.length === 0 || pending.some((p) => !p.reason.trim())}
                title={pending.some((p) => !p.reason.trim()) ? 'Every adjustment needs a reason.' : undefined}
                onClick={() => void saveAdjustments()}
                data-testid="charges-save"
              >
                {busy === 'save' ? 'Saving…' : saveAdjustmentsLabel(pending.length)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n))
  return dt.toISOString().slice(0, 10)
}

function Tile({ label: words, amount, record, sub, accent, testId }: { label: string; amount: number; record: number; sub: string; accent?: boolean; testId: string }) {
  const differs = Math.abs(amount - record) >= 0.005
  return (
    <div style={{ border: `1px solid ${accent ? 'var(--text-blue-700, var(--border-strong))' : 'var(--border)'}`, borderRadius: 8, padding: '0.5rem 0.75rem', display: 'grid', gap: 2 }} data-testid={testId}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{words}</span>
      <Money amount={amount} style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }} />
      <span style={quiet}>
        {sub}
        {differs ? (
          <>
            {' · the record '}
            <Money amount={record} />
          </>
        ) : null}
      </span>
    </div>
  )
}

function WeekRows({ weekStart, days, editable, pendingByKey, shapeValueFor, onShape, onKeep, onReason }: { weekStart: string; days: CrewDay[]; editable: boolean; pendingByKey: Map<string, Pending>; shapeValueFor: (d: CrewDay) => string; onShape: (d: CrewDay, value: string) => void; onKeep: (d: CrewDay, keep: boolean) => void; onReason: (key: string, reason: string) => void }) {
  const crewHours = days.reduce((a, d) => a + d.crewHours, 0)
  const charged = days.reduce((a, d) => a + (d.charged ?? 0), 0)
  return (
    <>
      <tr style={{ background: 'var(--bg-subtle)' }}>
        <td style={{ ...td, fontWeight: 700 }} colSpan={4}>
          {weekWords(weekStart)} · {days.length} {days.length === 1 ? 'day' : 'days'}
        </td>
        <td style={{ ...num, fontWeight: 700 }}>{crewHours.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
        <td style={num} />
        <td style={{ ...num, fontWeight: 700 }}>
          <Money amount={charged} />
        </td>
      </tr>
      {days.map((d) => {
        const shapeKey = pendingKey('day_shape', d.workDate)
        const offKey = pendingKey('day_off', d.workDate)
        const kept = !pendingByKey.has(offKey)
        const reasonKey = pendingByKey.has(shapeKey) ? shapeKey : pendingByKey.has(offKey) ? offKey : null
        return (
          <tr key={d.workDate} style={{ opacity: kept ? 1 : 0.55, background: d.adjusted || pendingByKey.has(shapeKey) ? 'var(--bg-amber-tint)' : undefined }} data-testid={`crew-day-${d.workDate}`}>
            <td style={{ ...td, width: 28 }}>
              <input type="checkbox" checked={kept} disabled={!editable} aria-label={`Count ${dayWords(d.workDate)}`} onChange={(e) => onKeep(d, e.target.checked)} />
            </td>
            <td style={td}>
              {dayWords(d.workDate)}
              {d.imported ? <span style={{ ...quiet, display: 'block' }}>from the pay records</span> : null}
            </td>
            <td style={td}>{d.people.map((p) => `${p.name} ${p.hours.toLocaleString('en-US', { maximumFractionDigits: 2 })}`).join(' · ')}</td>
            <td style={td}>
              <select value={shapeValueFor(d)} disabled={!editable || !kept} aria-label={`The crew on ${dayWords(d.workDate)}`} style={{ ...chip, maxWidth: 260 }} onChange={(e) => onShape(d, e.target.value)}>
                <option value="">{d.adjusted ? `${d.shapeWords.replace(' · adjusted', '')} · as the record reads` : d.shapeWords}</option>
                {CREW_SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {CREW_SHAPE_WORDS[s]}
                  </option>
                ))}
              </select>
              {reasonKey ? <input type="text" placeholder="Reason" aria-label={`Reason for ${dayWords(d.workDate)}`} style={{ ...field, marginTop: 4, width: '100%', maxWidth: 300 }} value={pendingByKey.get(reasonKey)?.reason ?? ''} onChange={(e) => onReason(reasonKey, e.target.value)} /> : null}
              {d.why && kept ? <span style={{ ...quiet, display: 'block', color: 'var(--text-amber-700, var(--text-muted))' }}>{d.why}</span> : null}
            </td>
            <td style={num}>{d.crewHours.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
            <td style={num}>{d.rate != null ? <Money amount={d.rate} /> : <span style={quiet}>—</span>}</td>
            <td style={num}>{d.charged != null ? <Money amount={d.charged} /> : <span style={quiet}>—</span>}</td>
          </tr>
        )
      })}
    </>
  )
}
