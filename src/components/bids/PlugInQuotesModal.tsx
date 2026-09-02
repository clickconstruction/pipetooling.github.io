/**
 * "Plug in quotes" modal (RFQ Phase 1b, v2.2630 — docs/SUPPLY_HOUSE_RFQ_PLAN.md;
 * design canvas "Supply House Pricing Requests" artboard 7). Lane C: paste a
 * vendor's raw reply — text, email, phone-call notes — and it becomes a
 * structured quote. `parseVendorReply` proposes matches; the human corrects
 * (assign/clear fixtures, fix prices, set basis), or skips the paste and types
 * lines directly. Save writes `bid_quotes` + `bid_quote_lines` (raw paste kept
 * for provenance) and upserts the name-keyed `supply_house_fixture_prices`
 * memory. Prices held as $/each; basis (box of 50, per 100…) derives it.
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import { parseVendorReply, type ReplyBasis } from '../../lib/rfq/parseVendorReply'
import { extractReplyText } from '../../lib/rfq/extractReplyText'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

const MODAL_Z = 10050

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: MODAL_Z,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '1.5rem 1rem',
  overflowY: 'auto',
}

const panel: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  maxWidth: 1080,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const BASIS_LABEL: Record<ReplyBasis, string> = { each: '/each', ft: '/ft', per_100: '/100', box: '/box' }

/** One editable quote line in the modal (parsed or hand-typed). */
type DraftLine = {
  key: string
  fixture: string | null
  unitPriceEach: string
  basis: ReplyBasis
  basisQty: number
  cantSupply: boolean
  confidence: 'exact' | 'fuzzy' | 'manual'
  raw: string | null
  outlier: boolean
  /** Rung G (v2.2655): checked for lot grouping / assigned lot. */
  lotCheck?: boolean
  lotKey?: string | null
}

function centsToStr(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toFixed(2)
}

function strToCents(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export function PlugInQuotesModal({
  open,
  onClose,
  onSaved,
  bidId,
  bidVersionId,
  bidLabel,
  rows,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  bidId: string
  bidVersionId: string | null
  bidLabel: string
  rows: Array<{ id: string; fixture: string; count: number; unit?: string | null }>
}) {
  const { showToast } = useToastContext()
  const [houses, setHouses] = useState<Array<{ id: string; name: string }>>([])
  const [houseId, setHouseId] = useState('')
  const [quotedBy, setQuotedBy] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [freight, setFreight] = useState('')
  const [raw, setRaw] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [unassigned, setUnassigned] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Lots: package prices — one total spanning several lines, no per-line unit.
  const [lots, setLots] = useState<Record<string, { totalCents: number }>>({})
  const [lotTotalInput, setLotTotalInput] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await withSupabaseRetry(
        () => supabase.from('supply_houses').select('id, name').order('name'),
        'load supply houses',
      )
      setHouses((data ?? []).map((h) => ({ id: h.id, name: h.name })))
    } catch {
      setHouses([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setHouseId('')
    setQuotedBy('')
    setValidUntil('')
    setFreight('')
    setRaw('')
    setLines([])
    setUnassigned([])
    setLots({})
    setLotTotalInput('')
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const fixtureOptions: SearchableSelectOption[] = useMemo(() => {
    const seen = new Set<string>()
    const opts: SearchableSelectOption[] = []
    for (const r of rows) {
      const name = r.fixture.trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      opts.push({ value: name, label: `${name} — ${r.count}${(r.unit ?? '').trim() ? ` ${(r.unit ?? '').trim()}` : ''}` })
    }
    return opts
  }, [rows])

  /** Rung E (v2.2651): drop a file — extracted text flows THROUGH the paste box, then matches. */
  async function handleFile(file: File) {
    setExtracting(true)
    try {
      const res = await extractReplyText(file)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      const text = `${res.meta}\n${res.text}`
      setRaw(text)
      runMatch(text)
    } finally {
      setExtracting(false)
    }
  }

  function runMatch(text?: string) {
    // The [file: …] provenance header stays visible in the paste box but is
    // not a vendor line — keep it out of the parser.
    const source = (text ?? raw).split('\n').filter((l) => !l.startsWith('[file:')).join('\n')
    const parsed = parseVendorReply(source, rows.map((r) => ({ name: r.fixture, count: r.count, unit: r.unit })))
    const draft: DraftLine[] = []
    let i = 0
    for (const line of parsed.lines) {
      const targets: Array<string | null> = line.fixtures.length > 0 ? line.fixtures : [null]
      for (const fixture of targets) {
        draft.push({
          key: `p${i++}`,
          fixture,
          unitPriceEach: centsToStr(line.unitPriceEachCents),
          basis: line.basis,
          basisQty: line.basisQty,
          cantSupply: line.cantSupply,
          confidence: line.confidence,
          raw: line.raw,
          outlier: line.outlier,
        })
      }
    }
    setLines(draft)
    setUnassigned(parsed.unassigned)
  }

  function addManualLine() {
    setLines((prev) => [
      ...prev,
      { key: `m${prev.length}-${prev.filter((l) => l.key.startsWith('m')).length}`, fixture: null, unitPriceEach: '', basis: 'each', basisQty: 1, cantSupply: false, confidence: 'manual', raw: null, outlier: false },
    ])
  }

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const savableLines = lines.filter((l) => l.fixture && (l.cantSupply || strToCents(l.unitPriceEach) != null || (l.lotKey && lots[l.lotKey])))

  const lotChecked = lines.filter((l) => l.lotCheck && l.fixture && !l.lotKey)

  /** Group the checked lines into a lot with one total; per-line prices clear. */
  function groupLot() {
    const cents = strToCents(lotTotalInput)
    if (!cents || lotChecked.length < 2) return
    const key = crypto.randomUUID()
    setLots((m) => ({ ...m, [key]: { totalCents: cents } }))
    setLines((prev) => prev.map((l) => (l.lotCheck && l.fixture && !l.lotKey ? { ...l, lotKey: key, lotCheck: false, unitPriceEach: '', cantSupply: false } : l)))
    setLotTotalInput('')
  }

  function ungroupLot(key: string) {
    setLots((m) => { const n = { ...m }; delete n[key]; return n })
    setLines((prev) => prev.map((l) => (l.lotKey === key ? { ...l, lotKey: null } : l)))
  }

  async function save() {
    if (!houseId || savableLines.length === 0) return
    setSaving(true)
    try {
      const { data: quote, error: qErr } = await supabase
        .from('bid_quotes')
        .insert({
          bid_id: bidId,
          bid_version_id: bidVersionId,
          supply_house_id: houseId,
          quoted_by: quotedBy.trim() || null,
          source: raw.trim() ? 'pasted' : 'typed',
          valid_until: validUntil || null,
          freight_cents: strToCents(freight),
          raw_paste: raw.trim() || null,
        })
        .select('id')
        .single()
      if (qErr) throw qErr
      const lineRows = savableLines.map((l) => ({
        quote_id: quote.id,
        fixture: l.fixture!,
        unit_price_each_cents: l.cantSupply || l.lotKey ? null : strToCents(l.unitPriceEach),
        price_basis: l.basis,
        basis_qty: l.basisQty,
        cant_supply: l.cantSupply,
        match_confidence: l.confidence,
        matched_from: l.raw,
        lot_id: l.lotKey ?? null,
        lot_total_cents: l.lotKey ? (lots[l.lotKey]?.totalCents ?? null) : null,
      }))
      const { error: lErr } = await supabase.from('bid_quote_lines').insert(lineRows)
      if (lErr) throw lErr
      // Name-keyed price memory — the compounding output. Dedupe by the
      // generated fixture_key: two lines on the same fixture in one upsert
      // batch would error ("cannot affect row a second time").
      const memoryByKey = new Map<string, { supply_house_id: string; fixture: string; unit_price_each_cents: number; quoted_at: string; source_bid_id: string }>()
      for (const l of savableLines) {
        const cents = l.cantSupply ? null : strToCents(l.unitPriceEach)
        if (cents == null) continue
        memoryByKey.set(l.fixture!.trim().toLowerCase(), {
          supply_house_id: houseId,
          fixture: l.fixture!,
          unit_price_each_cents: cents,
          quoted_at: new Date().toISOString(),
          source_bid_id: bidId,
        })
      }
      const memory = [...memoryByKey.values()]
      if (memory.length > 0) {
        const { error: mErr } = await supabase
          .from('supply_house_fixture_prices')
          .upsert(memory, { onConflict: 'supply_house_id,fixture_key' })
        if (mErr) throw mErr
      }
      showToast(`Quote saved — ${savableLines.length} line${savableLines.length === 1 ? '' : 's'} from ${houses.find((h) => h.id === houseId)?.name ?? 'the vendor'}.`, 'success')
      onSaved()
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the quote.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const input: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }

  return createPortal(
    <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Plug in quotes" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Plug in quotes</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {bidLabel} · paste the vendor’s reply — any shape — and it becomes a quote. Or type lines directly.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ ...smallMuted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.7rem' }}>Quote from</span>
          <div style={{ minWidth: 220 }}>
            <SearchableSelect value={houseId} onChange={setHouseId} options={houses.map((h) => ({ value: h.id, label: h.name }))} placeholder="pick a supply house…" portalZIndex={MODAL_Z + 10} listMinWidthPx={300} />
          </div>
          <input value={quotedBy} onChange={(e) => setQuotedBy(e.target.value)} placeholder="rep (optional)" style={{ ...input, width: 140 }} />
          <label style={{ ...smallMuted, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            good until <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={input} />
          </label>
          <label style={{ ...smallMuted, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            freight $ <input value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="0" style={{ ...input, width: 70 }} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.4fr)', gap: '0.9rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) void handleFile(f)
              }}
              style={{ border: `2px dashed ${dragOver ? '#2563eb' : 'var(--border-strong)'}`, borderRadius: 8, padding: '0.5rem 0.7rem', textAlign: 'center', fontSize: '0.75rem', color: dragOver ? 'var(--text-blue-500)' : 'var(--text-muted)', marginBottom: '0.4rem' }}
            >
              {extracting ? 'Reading the file…' : (
                <>
                  Drop the vendor’s reply — <strong>.xlsx · .csv · .pdf</strong> — or{' '}
                  <label style={{ color: 'var(--text-blue-500)', cursor: 'pointer', textDecoration: 'underline' }}>
                    browse
                    <input type="file" accept=".xlsx,.csv,.txt,.pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }} />
                  </label>
                  {' '}— or paste below
                </>
              )}
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'Paste the reply…\n4" cast iron 18.90/ft\n3/4 viega 90s $368/box of 50\nwc carriers no stock'}
              style={{ ...input, minHeight: 180, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => runMatch()} disabled={!raw.trim()} style={{ padding: '0.4rem 0.9rem', background: raw.trim() ? '#2563eb' : 'var(--bg-200)', color: raw.trim() ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, cursor: raw.trim() ? 'pointer' : 'not-allowed', font: 'inherit', fontWeight: 600, fontSize: '0.8125rem' }}>
                Match to fixtures
              </button>
              <button type="button" onClick={addManualLine} style={{ padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
                + Add a line by hand
              </button>
            {lotChecked.length >= 2 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #f59e0b', background: 'var(--bg-yellow-tint)', borderRadius: 6, padding: '0.4rem 0.7rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-amber-700)', fontWeight: 600 }}>
                  These {lotChecked.length} lines were priced together — total $
                </span>
                <input value={lotTotalInput} onChange={(e) => setLotTotalInput(e.target.value)} placeholder="18,400.00" inputMode="decimal" style={{ ...input, width: '7rem', textAlign: 'right' }} />
                <button type="button" disabled={!strToCents(lotTotalInput)} onClick={groupLot} style={{ padding: '0.3rem 0.8rem', background: strToCents(lotTotalInput) ? '#2563eb' : 'var(--bg-200)', color: strToCents(lotTotalInput) ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: strToCents(lotTotalInput) ? 'pointer' : 'not-allowed' }}>
                  Group as a lot
                </button>
              </div>
            ) : null}
            </div>
            {unassigned.length > 0 ? (
              <div style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-yellow-tint)', borderRadius: 6, padding: '0.5rem 0.7rem', fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>
                Couldn’t match {unassigned.length} line{unassigned.length === 1 ? '' : 's'} — add them by hand if they matter:
                <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--text-strong)', marginTop: 4 }}>{unassigned.join(' · ')}</div>
              </div>
            ) : null}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) 5.5rem 4.5rem 2rem', gap: '0.5rem', padding: '0.35rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              <span>Fixture</span><span>Matched from</span><span>$ / each</span><span>Basis</span><span></span>
            </div>
            <div style={{ maxHeight: '44vh', overflowY: 'auto' }}>
              {lines.length === 0 ? (
                <p style={{ margin: 0, padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Paste and hit Match — or add lines by hand.</p>
              ) : (
                lines.map((l) => (
                  <div key={l.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) 5.5rem 4.5rem 2rem', gap: '0.5rem', padding: '0.3rem 0.6rem', borderBottom: '1px solid var(--bg-muted)', alignItems: 'center', background: l.fixture ? undefined : 'var(--bg-yellow-tint)' }}>
                    {l.fixture && !l.cantSupply ? (
                      <input
                        type="checkbox"
                        checked={!!l.lotCheck}
                        disabled={!!l.lotKey}
                        title={l.lotKey ? 'In a lot' : 'Check lines priced together as one package'}
                        aria-label={`Group ${l.fixture} into a lot`}
                        onChange={(e) => patchLine(l.key, { lotCheck: e.target.checked })}
                        style={{ marginRight: 4 }}
                      />
                    ) : null}
                    <SearchableSelect value={l.fixture ?? ''} onChange={(v) => patchLine(l.key, { fixture: v || null, confidence: 'manual' })} options={fixtureOptions} placeholder="assign a fixture…" portalZIndex={MODAL_Z + 10} listMinWidthPx={340} fillViewportHeight />
                    <span style={{ fontSize: '0.72rem', color: l.confidence === 'exact' ? '#15803d' : l.confidence === 'fuzzy' ? 'var(--text-amber-700)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                      {l.raw ? `${l.confidence === 'exact' ? '✓' : l.confidence === 'fuzzy' ? '?' : '·'} “${l.raw}”` : 'typed'}
                      {l.raw && /\b(all.?in|package|lot\b|combo|bundle)\b/i.test(l.raw) ? (
                        <span style={{ display: 'block', color: 'var(--text-amber-700)', fontWeight: 600 }}>package wording — one price for several items? plug totals carefully</span>
                      ) : null}
                      {l.outlier ? <strong style={{ color: 'var(--text-red-600)' }}> · price looks off</strong> : null}
                      {l.cantSupply ? <em> · can’t supply</em> : null}
                    </span>
                    {l.lotKey ? (
                      <button
                        type="button"
                        onClick={() => ungroupLot(l.lotKey!)}
                        title={`In a lot — $${((lots[l.lotKey]?.totalCents ?? 0) / 100).toFixed(2)} total for the group · click to ungroup`}
                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-amber-700)', background: 'var(--bg-yellow-tint)', border: '1px solid #f59e0b', borderRadius: 999, padding: '0.2rem 0.6rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        lot ${((lots[l.lotKey]?.totalCents ?? 0) / 100).toLocaleString('en-US')} ×
                      </button>
                    ) : (
                      <input value={l.unitPriceEach} onChange={(e) => patchLine(l.key, { unitPriceEach: e.target.value })} disabled={l.cantSupply} placeholder={l.cantSupply ? 'n/a' : '0.00'} style={{ ...input, textAlign: 'right', fontFamily: 'ui-monospace, Menlo, monospace' }} />
                    )}
                    <span style={{ ...smallMuted, fontFamily: 'ui-monospace, Menlo, monospace' }}>{BASIS_LABEL[l.basis]}{l.basis === 'box' ? `(${l.basisQty})` : ''}</span>
                    <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} aria-label="Remove line" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', font: 'inherit' }}>×</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={smallMuted}>
            {savableLines.length} savable line{savableLines.length === 1 ? '' : 's'}
            {!houseId ? ' · pick a supply house to save' : ''} · the raw paste is kept with the quote.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Cancel</button>
            <button type="button" disabled={!houseId || savableLines.length === 0 || saving} onClick={() => void save()} style={{ padding: '0.5rem 1.1rem', background: houseId && savableLines.length > 0 ? '#16a34a' : 'var(--bg-200)', color: houseId && savableLines.length > 0 ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, cursor: houseId && savableLines.length > 0 ? 'pointer' : 'not-allowed', font: 'inherit', fontWeight: 600 }}>
              {saving ? 'Saving…' : 'Save quote → compare'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
