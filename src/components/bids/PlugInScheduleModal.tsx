/**
 * "Plug in the fixture schedule" (Submittals stage 1, v2.3460 —
 * to-dos/submittals/README.md). The estimator pastes the plan's PLUMBING
 * FIXTURE SCHEDULE; `parseFixtureSchedule` proposes tag · make · model per
 * line and the count row each tag maps to; the human confirms or fixes;
 * Save upserts `bid_specified_products` on (bid, tag). From then on the
 * quote compare can say whether a pick is as specified, an alternate,
 * superseded, an equal, a design change, or missing.
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLeaveGuard } from '../../hooks/useLeaveGuard'
import { LeaveQuestion } from './SubmittalLeaveGuard'

import { parseFixtureSchedule, type ParsedScheduleLine } from '../../lib/submittals/parseFixtureSchedule'
import { supabase } from '../../lib/supabase'
import { checkSupabaseError, formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'

const MODAL_Z = 10050

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: MODAL_Z,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 'calc(1.5rem + var(--app-top-chrome, 0px)) 1rem 1.5rem',
  overflowY: 'auto',
}

const panel: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  maxWidth: 980,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const cellInput: CSSProperties = {
  font: 'inherit',
  fontSize: '0.8125rem',
  padding: '0.25rem 0.4rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  width: '100%',
  minWidth: 0,
}

/** One editable specified product in the modal. */
type DraftRow = {
  key: string
  tag: string
  manufacturer: string
  model: string
  description: string
  fixture: string
  confidence: ParsedScheduleLine['confidence'] | 'saved'
  raw: string | null
}

type ExistingRow = { tag: string; fixture: string | null; manufacturer: string | null; model: string | null; description: string | null }

function fromParsed(l: ParsedScheduleLine, i: number): DraftRow {
  return {
    key: `p-${i}`,
    tag: l.tag ?? '',
    manufacturer: l.manufacturer ?? '',
    model: l.model ?? '',
    description: l.description ?? '',
    fixture: l.fixtureMatches[0]?.fixture ?? '',
    confidence: l.confidence,
    raw: l.raw,
  }
}

function fromExisting(r: ExistingRow, i: number): DraftRow {
  return {
    key: `e-${i}`,
    tag: r.tag,
    manufacturer: r.manufacturer ?? '',
    model: r.model ?? '',
    description: r.description ?? '',
    fixture: r.fixture ?? '',
    confidence: 'saved',
    raw: null,
  }
}

const CONFIDENCE_CHIP: Record<DraftRow['confidence'], { text: string; color: string; bg: string }> = {
  exact: { text: '✓', color: 'var(--text-green-700)', bg: 'var(--bg-green-tint)' },
  fuzzy: { text: '?', color: 'var(--text-amber-700)', bg: 'var(--bg-yellow-tint)' },
  none: { text: '?', color: 'var(--text-amber-700)', bg: 'var(--bg-yellow-tint)' },
  saved: { text: 'on the bid', color: 'var(--text-muted)', bg: 'var(--bg-muted)' },
}

export function PlugInScheduleModal({
  open,
  onClose,
  onSaved,
  bidId,
  bidLabel,
  rows,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  bidId: string
  bidLabel: string
  rows: Array<{ id: string; fixture: string; count: number }>
}) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const [raw, setRaw] = useState('')
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [existingCount, setExistingCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  /**
   * Why the read of what is already on the bid failed. Until it loads, pasting and saving are
   * off: a save upserts on (bid, tag), so it could replace rows the estimator never saw.
   */
  const [loadError, setLoadError] = useState<string | null>(null)
  // 2026-10-04 · a tag typed, pasted, changed or removed and not saved: a stray click outside asks before it loses it.
  const [touched, setTouched] = useState(false)

  const fixtures = useMemo(() => rows.map((r) => ({ id: r.id, fixture: r.fixture })), [rows])

  const loadExisting = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await withSupabaseRetry(
        () => supabase.from('bid_specified_products').select('tag, fixture, manufacturer, model, description').eq('bid_id', bidId).order('tag'),
        'load specified products',
      )
      const list = (data ?? []) as ExistingRow[]
      setExistingCount(list.length)
      setDrafts(list.map(fromExisting))
    } catch (err) {
      setExistingCount(0)
      setDrafts([])
      setLoadError(formatErrorMessage(err, "Couldn't load what is already on the bid."))
    } finally {
      setLoading(false)
    }
  }, [bidId])

  useEffect(() => {
    if (!open) return
    setRaw('')
    setSkipped([])
    setTouched(false)
    void loadExisting()
  }, [open, loadExisting])

  const match = () => {
    const parsed = parseFixtureSchedule(raw, fixtures)
    const fresh = parsed.lines.filter((l) => l.tag).map(fromParsed)
    // A pasted tag replaces the saved row of the same tag; saved rows the paste did not name stay.
    const pastedTags = new Set(fresh.map((d) => d.tag.toUpperCase()))
    setDrafts((cur) => [...fresh, ...cur.filter((d) => d.confidence === 'saved' && !pastedTags.has(d.tag.toUpperCase()))])
    setSkipped(parsed.skipped)
    if (fresh.length > 0) setTouched(true)
    if (fresh.length === 0) showToast('No tags found — a line should start with the schedule mark, like WC-1 or LAV-2.', 'error')
  }

  const update = (key: string, patch: Partial<DraftRow>) => { setTouched(true); setDrafts((cur) => cur.map((d) => (d.key === key ? { ...d, ...patch } : d))) }
  const remove = (key: string) => { setTouched(true); setDrafts((cur) => cur.filter((d) => d.key !== key)) }
  const addBlank = () => setDrafts((cur) => [...cur, { key: `t-${Date.now()}`, tag: '', manufacturer: '', model: '', description: '', fixture: '', confidence: 'none', raw: null }])

  const save = async () => {
    const ready = drafts.filter((d) => d.tag.trim())
    if (ready.length === 0) {
      showToast('Nothing to save — every row needs a tag.', 'error')
      return
    }
    const seen = new Set<string>()
    for (const d of ready) {
      const t = d.tag.trim().toUpperCase()
      if (seen.has(t)) {
        showToast(`${t} appears twice — keep one.`, 'error')
        return
      }
      seen.add(t)
    }
    setSaving(true)
    try {
      const payload = ready.map((d) => ({
        bid_id: bidId,
        tag: d.tag.trim().toUpperCase(),
        fixture: d.fixture.trim() || null,
        manufacturer: d.manufacturer.trim() || null,
        model: d.model.trim() || null,
        description: d.description.trim() || null,
        source: d.raw ? 'pasted' : 'typed',
        confirmed_by: user?.id ?? null,
        confirmed_at: new Date().toISOString(),
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }))
      const res = await supabase.from('bid_specified_products').upsert(payload, { onConflict: 'bid_id,tag' })
      checkSupabaseError(res, 'save the specified products')
      showToast(`${ready.length} specified product${ready.length === 1 ? '' : 's'} saved on the bid.`, 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the specified products.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const guard = useLeaveGuard({ dirty: touched || raw.trim() !== '', onClose, busy: saving, paused: !open })

  if (!open) return null

  const unmatched = drafts.filter((d) => d.tag && !d.fixture).length

  return createPortal(
    <div style={overlay} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) guard.requestClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Plug in the fixture schedule" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Plug in the fixture schedule</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {bidLabel} · paste the plan’s schedule; each tag becomes the specified make and model the quotes are compared to.
              {existingCount > 0 ? ` ${existingCount} already on the bid — a pasted tag replaces its row.` : ''}
            </p>
          </div>
          <button type="button" onClick={guard.requestClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>×</button>
        </div>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'WC-1  WATER CLOSET, WALL HUNG  TOTO CT708UVG#01 / TET2UA31#SS 1.0 GPF\nLAV-1  LAVATORY  TOTO LT307 / TEL145\nDWH-1  WATER HEATER  RHEEM PROPH40 T2 RH375 40 GAL'}
          rows={5}
          style={{ ...cellInput, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={match} disabled={!raw.trim() || loading || loadError != null} style={{ padding: '0.4rem 0.85rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: raw.trim() ? 'pointer' : 'default', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, opacity: raw.trim() ? 1 : 0.5 }}>
            Match to tags
          </button>
          <button type="button" onClick={addBlank} disabled={loading || loadError != null} style={{ padding: '0.4rem 0.7rem', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
            + Add a tag by hand
          </button>
          {skipped.length > 0 ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{skipped.length} header or blank line{skipped.length === 1 ? '' : 's'} skipped</span> : null}
        </div>

        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading what is already on the bid…</p>
        ) : loadError ? (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>{loadError} Matching and saving are off until it loads, so nothing on the bid is replaced unseen.</p>
            <button type="button" onClick={() => void loadExisting()} style={{ padding: '0.3rem 0.7rem', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
              Retry
            </button>
          </div>
        ) : drafts.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '5.5rem 1.2fr 1fr 1.4fr 1.2fr 3rem 1.6rem', gap: '0.4rem', alignItems: 'center', padding: '0.3rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              <span>Tag</span><span>Make</span><span>Model</span><span>Description</span><span>Count row</span><span /><span />
            </div>
            <div style={{ maxHeight: '48vh', overflowY: 'auto' }}>
              {drafts.map((d) => {
                const chip = CONFIDENCE_CHIP[d.confidence]
                return (
                  <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '5.5rem 1.2fr 1fr 1.4fr 1.2fr 3rem 1.6rem', gap: '0.4rem', alignItems: 'center', padding: '0.25rem 0.6rem', borderBottom: '1px solid var(--bg-muted)' }} title={d.raw ?? undefined}>
                    <input value={d.tag} onChange={(e) => update(d.key, { tag: e.target.value })} aria-label="Tag" style={{ ...cellInput, fontWeight: 700 }} />
                    <input value={d.manufacturer} onChange={(e) => update(d.key, { manufacturer: e.target.value })} aria-label="Make" style={cellInput} />
                    <input value={d.model} onChange={(e) => update(d.key, { model: e.target.value })} aria-label="Model" style={cellInput} />
                    <input value={d.description} onChange={(e) => update(d.key, { description: e.target.value })} aria-label="Description" style={cellInput} />
                    <select value={d.fixture} onChange={(e) => update(d.key, { fixture: e.target.value })} aria-label="Count row" style={{ ...cellInput, color: d.fixture ? 'var(--text-base)' : 'var(--text-amber-700)' }}>
                      <option value="">not on a count row</option>
                      {rows.map((r) => (
                        <option key={r.id} value={r.fixture}>{r.fixture}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: chip.color, background: chip.bg, borderRadius: 999, padding: '0.1rem 0.45rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{chip.text}</span>
                    <button type="button" onClick={() => remove(d.key)} aria-label={`Remove ${d.tag || 'row'}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', font: 'inherit' }}>×</button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Nothing on the bid yet — paste the schedule and tap Match to tags, or add a tag by hand.</p>
        )}

        {guard.asking ? <LeaveQuestion what="The schedule you typed is not saved yet." onLeave={onClose} onKeep={guard.keep} /> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {drafts.filter((d) => d.tag).length} tag{drafts.filter((d) => d.tag).length === 1 ? '' : 's'}
            {unmatched > 0 ? ` · ${unmatched} not on a count row (saved anyway; the compare shows only rows the quotes name)` : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" disabled={saving} onClick={guard.requestClose} style={{ padding: '0.4rem 0.85rem', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving || drafts.length === 0 || loading || loadError != null} style={{ padding: '0.4rem 0.85rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'default' : 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, opacity: saving || drafts.length === 0 ? 0.6 : 1 }}>
              {saving ? 'Saving…' : `Save ${drafts.filter((d) => d.tag).length} specified products`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
