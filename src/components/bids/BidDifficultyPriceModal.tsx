/**
 * Bid Board → Pricing rules (punch list #357, PR 4): the price list that turns a GC's rating into cost lines.
 *
 * The owner, the controller and a dev edit; everyone else with the board reads. The sheet opens on the published
 * version's numbers; an edit makes a draft, and **Save as version N** writes the draft and publishes it in one press
 * (the database takes the number and freezes the row). Bids priced under the old version keep their lines. **Every
 * version** lists what each one said. The try-it line runs the kernel on the canvas's example, so a change is read
 * in dollars before it is saved.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ModalShell } from './ModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  DIFFICULTY_PRICE_V1,
  DIFFICULTY_PRICE_WORDS as W,
  DIFFICULTY_RATERS,
  DIFFICULTY_RATER_WORDS,
  difficultyCanEditPrice,
  difficultyPriceProblems,
  difficultyPriceVersionWords,
  difficultyPriceWords,
  type DifficultyPriceList,
  type DifficultyPriceNumberKey,
  type DifficultyRater,
} from '../../lib/bids/difficultyPrice'
import { draftDifficultyPrice, publishedDifficultyPrice, supabaseDifficultyPriceIo, type DifficultyPriceIo, type DifficultyPriceVersion } from '../../lib/bids/difficultyPriceIo'
import { difficultyLines } from '../../lib/bids/difficultyLines'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseDifficultyPriceIo()

const CARD: CSSProperties = { background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 12, maxWidth: 720, width: '94%', maxHeight: 'min(92vh, 100%)', overflow: 'auto', border: '1px solid var(--border)', display: 'grid', gap: '0.9rem' }
const TITLE: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const RULE: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }
const NUM: CSSProperties = { font: 'inherit', fontWeight: 700, width: '4.2rem', textAlign: 'right', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)' }
const PRESS: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, height: 36, padding: '0 0.75rem', cursor: 'pointer' }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }
const TRY: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.45 }
const PROBLEMS: CSSProperties = { margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', display: 'grid', gap: '0.2rem' }

function savePress(dead: boolean): CSSProperties {
  return { ...PRESS, height: 44, padding: '0 1.1rem', border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer' }
}

/** The canvas's example: 480 field hours at $80 on a $172,400 bid, rated 4 points, paid in 62 days. */
const EXAMPLE = { fieldHours: 480, laborRate: 80, price: 172400, ownCost: 114266, medianDays: 62 }

function tryItWords(p: DifficultyPriceList): string {
  const d = difficultyLines({
    scales: [
      { key: 'field', name: 'Field', points: 2, sentence: '' },
      { key: 'office', name: 'Office', points: 1, sentence: '' },
      { key: 'paying', name: 'Paying', points: 1, sentence: '' },
    ],
    price: p,
    fieldHours: EXAMPLE.fieldHours,
    laborRate: EXAMPLE.laborRate,
    ownCost: EXAMPLE.ownCost,
    carried: EXAMPLE.price,
    payingMedianDays: EXAMPLE.medianDays,
    payingReason: `Read from their bills: Paid in ${EXAMPLE.medianDays} days, the median of 7 bills.`,
  })
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
  const parts = d.lines.map((l) => `${l.name.toLowerCase()} ${l.points} is ${money(l.amount)}`)
  const onPrice = money(d.total / 0.7)
  const skipped = d.skipped.map((s) => `${s.name} adds nothing: ${s.why}.`).join(' ')
  const cap = d.capped ? ` The cap held them to ${money(d.capped.cap)}.` : ''
  return `Try it on a bid with ${EXAMPLE.fieldHours} field hours at ${money(EXAMPLE.laborRate)}, priced at ${money(EXAMPLE.price)}, to a GC rated field 2, office 1 and paying 1, paid in ${EXAMPLE.medianDays} days: ${parts.join(', ')}. ${money(d.total)} of cost, about ${onPrice} on the price at 30%.${cap}${skipped ? ` ${skipped}` : ''}`
}

type Field = { key: DifficultyPriceNumberKey; label: string; step?: number }

export function BidDifficultyPriceModal({ role, onClose, io = DEFAULT_IO }: { role: string | null | undefined; onClose: () => void; io?: DifficultyPriceIo }) {
  const { showToast } = useToastContext()
  const canEdit = difficultyCanEditPrice(role)
  const [versions, setVersions] = useState<DifficultyPriceVersion[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DifficultyPriceList | null>(null)
  const [text, setText] = useState<Partial<Record<DifficultyPriceNumberKey, string>>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await io.loadVersions()
      setVersions(rows)
      setLoadError(null)
      const d = draftDifficultyPrice(rows)
      const base = d?.body ?? publishedDifficultyPrice(rows)?.body ?? DIFFICULTY_PRICE_V1
      setDraft({ ...base, raters: [...base.raters] })
      setText({})
      setDirty(d != null)
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'The pricing rules could not be read.'))
    }
  }, [io])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const published = useMemo(() => (versions ? publishedDifficultyPrice(versions) : null), [versions])
  const draftRow = useMemo(() => (versions ? draftDifficultyPrice(versions) : null), [versions])
  const next = (published?.version ?? 0) + 1
  const problems = useMemo(() => (draft ? difficultyPriceProblems(draft) : []), [draft])
  const shown = draft ?? published?.body ?? DIFFICULTY_PRICE_V1

  const setNumber = (key: DifficultyPriceNumberKey, raw: string) => {
    setText((t) => ({ ...t, [key]: raw }))
    const n = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(n)) {
      setDraft((d) => (d ? { ...d, [key]: n } : d))
      setDirty(true)
    }
  }
  const toggleRater = (r: DifficultyRater) => {
    setDraft((d) => (d ? { ...d, raters: d.raters.includes(r) ? d.raters.filter((x) => x !== r) : [...d.raters, r] } : d))
    setDirty(true)
  }

  const save = async () => {
    if (!draft || problems.length > 0 || saving) return
    setSaving(true)
    try {
      const saved = await io.saveDraft(draftRow?.id ?? null, draft, '')
      const pub = await io.publish(saved.id)
      showToast(W.saved(pub.version), 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The pricing rules were not saved.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const numberInput = (f: Field) => (
    <input
      type="number"
      step={f.step ?? 1}
      min={0}
      value={text[f.key] ?? String(shown[f.key])}
      onChange={(e) => setNumber(f.key, e.target.value)}
      onWheel={(e) => e.currentTarget.blur()}
      aria-label={f.label}
      readOnly={!canEdit}
      style={{ ...NUM, ...(canEdit ? {} : { background: 'var(--bg-subtle)', color: 'var(--text-700)' }) }}
    />
  )

  const dead = !canEdit || !dirty || problems.length > 0 || saving || !draft

  return (
    <ModalShell cardStyle={CARD} zIndex={1000}>
      <div role="dialog" aria-modal="true" aria-labelledby="difficulty-price-title" data-testid="difficulty-price-modal" style={{ display: 'grid', gap: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h2 id="difficulty-price-title" style={TITLE}>{W.title}</h2>
          <span style={MUTED}>{published ? `${difficultyPriceVersionWords(published)} · ${W.lead}` : W.lead}</span>
          <span style={{ flexGrow: 1 }} />
          <button type="button" onClick={onClose} aria-label={W.close} style={{ ...PRESS, width: 36, padding: 0, fontSize: '1.1rem' }}>
            ×
          </button>
        </div>
        {loadError ? <p style={{ ...MUTED, color: 'var(--text-red-700)' }}>{loadError}</p> : null}
        {!canEdit ? <p style={MUTED}>{W.readOnly}</p> : null}
        {versions && !published ? <p style={{ ...MUTED, color: 'var(--text-amber-800)' }}>{W.noVersion}</p> : null}

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={RULE}>
            <span>Each <strong>field</strong> point adds</span>
            {numberInput({ key: 'fieldPctPerPoint', label: 'Percent of field hours for a field point', step: 0.5 })}
            <span>% of the bid's field hours at its labor rate</span>
          </div>
          <div style={RULE}>
            <span>Each <strong>office</strong> point adds</span>
            {numberInput({ key: 'officeHoursPerPoint', label: 'Office hours for an office point', step: 1 })}
            <span>office hours at $</span>
            {numberInput({ key: 'officeRate', label: 'Office rate an hour', step: 1 })}
            <span>an hour</span>
          </div>
          <div style={RULE}>
            <span>Each <strong>site</strong> point adds</span>
            {numberInput({ key: 'sitePctPerPoint', label: 'Percent of field hours for a site point', step: 0.5 })}
            <span>% of the bid's field hours at its labor rate</span>
          </div>
          <div style={RULE}>
            <span>The <strong>paying</strong> point: the days past</span>
            {numberInput({ key: 'payingDaysPast', label: 'Days a paying point starts past', step: 1 })}
            <span>on the price at</span>
            {numberInput({ key: 'payingMonthlyRate', label: 'Monthly rate on the price', step: 0.1 })}
            <span>% a month</span>
          </div>
          <div style={RULE}>
            <span>Never more than</span>
            {numberInput({ key: 'capPct', label: 'Cap as a percent of the bid cost', step: 1 })}
            <span>% of the bid's own cost, all lines together</span>
          </div>
          <div style={RULE}>
            <span>Paying is read from bills when a GC has</span>
            {numberInput({ key: 'payingMinBills', label: 'Bills a read needs', step: 1 })}
            <span>or more, or when</span>
            {numberInput({ key: 'payingLateBillsInYear', label: 'Late bills in a year', step: 1 })}
            <span>in a year ran past their calendar</span>
          </div>
          <div style={RULE}>
            <span>{W.ratersLabel}:</span>
            {DIFFICULTY_RATERS.map((r) => (
              <label key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <input type="checkbox" checked={shown.raters.includes(r)} onChange={() => toggleRater(r)} disabled={!canEdit} aria-label={DIFFICULTY_RATER_WORDS[r]} />
                <span>{DIFFICULTY_RATER_WORDS[r]}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={TRY} data-testid="difficulty-price-try">{tryItWords(shown)}</div>
        {problems.length > 0 ? (
          <ul style={PROBLEMS}>
            {problems.map((pr) => (
              <li key={pr}>{pr}</li>
            ))}
          </ul>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
          {published ? <span style={MUTED}>{W.keepLines(published.version)}</span> : null}
          <span style={{ flexGrow: 1 }} />
          {versions && versions.some((v) => v.status === 'published') ? (
            <button type="button" style={QUIET} onClick={() => setShowVersions((s) => !s)} aria-expanded={showVersions}>
              {W.everyVersion}
            </button>
          ) : null}
          {canEdit ? (
            <button type="button" style={savePress(dead)} disabled={dead} onClick={() => void save()} data-testid="difficulty-price-save">
              {saving ? 'Saving…' : W.saveAs(next)}
            </button>
          ) : null}
        </div>
        {showVersions && versions ? (
          <div style={{ display: 'grid', gap: '0.6rem' }} data-testid="difficulty-price-versions">
            {versions
              .filter((v) => v.status === 'published')
              .map((v) => (
                <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', display: 'grid', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{difficultyPriceVersionWords(v)}</span>
                  {difficultyPriceWords(v.body).map((line) => (
                    <span key={line} style={MUTED}>
                      {line}
                    </span>
                  ))}
                </div>
              ))}
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}

export default BidDifficultyPriceModal
