import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { JobFormFactRow } from './JobFormFactRow'
import { loadRateCard, saveJobChargeRule } from '../../lib/charges/jobChargesRead'
import { jobChargeRuleFrom, type JobChargeRule } from '../../lib/charges/crewDays'
import { CREW_SHAPES, CREW_SHAPE_LOWER, crewRateFor, crewRateWords, parseCrewShape, type CrewShape, type RateCard } from '../../lib/charges/rateCard'
import { jobChargingValueWords } from '../../lib/charges/jobChargingWords'
import { markupMarginWords } from '../../lib/charges/markupMargin'
import { MaterialsMarkupPair } from '../charges/MaterialsMarkupPair'

/**
 * Edit Job → *Charging the customer* (punch list #254, PR 4): the job's rule for its labor — the crew on each day from
 * the rate card, one shape throughout at its rate, or a flat rate — and its own markup on materials, the company's
 * figures named when the job has none. Written straight to the job as you pick (`saveJobChargeRule`), the same
 * columns the Job Summary's Charges window writes, never through the autosave slice. The job decides the rate; every
 * Statement of charges and charged hours paper reads it from here.
 */

type Loaded = { rule: JobChargeRule; markupPct: number | null }

const field: CSSProperties = { padding: '0.3rem 0.4rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const label: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.8125rem' }
const small: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

function markupFrom(v: unknown): number | null {
  const n = typeof v === 'number' ? v : v == null || v === '' ? NaN : Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function JobFormChargingRow({ jobId, expanded, onToggle }: { jobId: string; expanded: boolean; onToggle: () => void }) {
  const { showToast } = useToastContext()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [card, setCard] = useState<RateCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data, error: readError }, rateCard] = await Promise.all([supabase.from('jobs_ledger').select('*').eq('id', jobId).maybeSingle(), loadRateCard()])
      if (readError) throw readError
      const row = (data ?? {}) as { charge_rule?: unknown; charge_shape?: unknown; hourly_charge_rate?: unknown; materials_markup_pct?: unknown }
      setLoaded({ rule: jobChargeRuleFrom(row, parseCrewShape), markupPct: markupFrom(row.materials_markup_pct) })
      setCard(rateCard)
    } catch (e) {
      setError(formatErrorMessage(e, 'The job’s charging rule could not be read.'))
    }
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (rule: JobChargeRule, markupPct: number | null) => {
    if (busy) return
    setBusy(true)
    try {
      await saveJobChargeRule(jobId, rule, markupPct)
      setLoaded({ rule, markupPct })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The job’s charging rule could not be saved.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const value = loaded && card ? jobChargingValueWords(loaded.rule, loaded.markupPct, card) : error ? 'could not be read' : 'Loading…'
  const rule = loaded?.rule ?? { kind: 'crew' as const }

  return (
    <div data-testid="charging-row">
      <JobFormFactRow label="Charging the customer" value={value} expanded={expanded} onToggle={onToggle} last>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>What a Statement of charges prices this job’s labor and materials at. Blank means the company’s rate card and markup from Settings.</label>
        {error ? (
          <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'start' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }} data-testid="charging-error">{error}</p>
            <button type="button" onClick={() => void load()} style={{ ...field, cursor: 'pointer', fontWeight: 600 }}>
              Try again
            </button>
          </div>
        ) : !loaded || !card ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.2rem', alignItems: 'flex-end', minWidth: 0 }}>
              <label style={{ ...label, flex: '1 1 16rem', minWidth: 0, maxWidth: 420 }}>
                <span style={small}>Charge this job’s labor as</span>
                <select
                  value={rule.kind === 'shape' ? `shape:${rule.shape}` : rule.kind}
                  disabled={busy}
                  aria-label="Charge this job’s labor as"
                  data-testid="charging-rule"
                  style={{ ...field, width: '100%', minWidth: 0 }}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'crew') void save({ kind: 'crew' }, loaded.markupPct)
                    else if (v === 'flat') void save({ kind: 'flat', rate: rule.kind === 'flat' ? rule.rate : (card.rates.master_helper ?? 0) }, loaded.markupPct)
                    else if (v.startsWith('shape:')) void save({ kind: 'shape', shape: v.slice(6) as CrewShape }, loaded.markupPct)
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
              <label style={label}>
                <span style={small}>{rule.kind === 'flat' ? 'Flat rate, dollars an hour' : 'Flat rate · off while a shape or the rate card is chosen'}</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  key={rule.kind === 'flat' ? `flat-${rule.rate}` : 'flat-off'}
                  defaultValue={rule.kind === 'flat' ? rule.rate || '' : ''}
                  disabled={busy || rule.kind !== 'flat'}
                  aria-label="Flat rate, dollars an hour"
                  data-testid="charging-flat"
                  style={{ ...field, width: 120, textAlign: 'right' }}
                  onBlur={(e) => {
                    const n = Number(e.target.value)
                    if (rule.kind === 'flat' && Number.isFinite(n) && n > 0 && n !== rule.rate) void save({ kind: 'flat', rate: Math.round(n * 100) / 100 }, loaded.markupPct)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
              </label>
              <div style={{ display: 'grid', gap: 3 }}>
                <span style={small}>Markup on materials{loaded.markupPct == null ? (card.materialsMarkupPct != null ? ', the company’s' : ', none') : ', this job’s own'}</span>
                <MaterialsMarkupPair
                  compact
                  markupPct={loaded.markupPct}
                  companyMarkupPct={card.materialsMarkupPct}
                  disabled={busy}
                  testId="charging-markup"
                  onCommit={(next) => {
                    if (next !== loaded.markupPct) void save(loaded.rule, next)
                  }}
                />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {card.materialsMarkupPct != null ? `Company: ${markupMarginWords(card.materialsMarkupPct)}. ` : 'The company has no markup set, so materials are charged at cost unless this job says otherwise. '}
              Type the markup or the margin and the other follows. The Charges window on the Job Summary writes these too, so a choice made there shows here. Saved on the job as you pick.
            </p>
          </div>
        )}
      </JobFormFactRow>
    </div>
  )
}
