/**
 * "Supply house list" modal (v2.2612; renamed from "Copy fixtures for text" in
 * v2.2618 — named for the document it produces, like Release of Lien). Opens
 * from the Share ▾ menu instead of copying blind (design: "Division 22 Ledger"
 * canvas, artboards 6–7):
 *
 *   - Vendor scope presets (Whole job · Pipe & fittings · Fixtures & equipment ·
 *     Custom) tick whole sections; any checkbox click flips to Custom.
 *   - This bid's uncoded names sit in an amber strip with inline Pin / No code —
 *     the same shared-ledger exact rules the audit writes (fix once, every bid).
 *   - A live preview pane renders the EXACT clipboard text for the selection
 *     (the kernel reuses the shipped grouped builder, so the preview IS the paste).
 *
 * Selection and scope are per-copy state — nothing persists, the bid never
 * changes. If the ledger can't load, a fallback still copies the flat list.
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import { type SpecSectionMatchKind, type SpecSectionMatchRule, classifySpecSection } from '../../lib/classifySpecSection'
import {
  buildPrepareCopyGroups,
  buildScopedFixtureCopyText,
  rowIdsForScope,
  scopeForSelection,
  type PrepareCopyRow,
  type PrepareCopyScope,
} from '../../lib/prepareFixtureCopy'
import { buildBidFixtureCountsText } from '../../lib/buildBidFixtureCountsText'
import { AUDIT_PIN_PRIORITY } from '../../lib/specSectionAudit'
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
  maxWidth: 1100,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

type RuleRow = { id: string; pattern: string; match_kind: string; section_code: string | null; priority: number }
const KNOWN_KINDS = new Set<string>(['starts_with', 'contains', 'exact'])

const SCOPES: Array<{ key: PrepareCopyScope; label: string }> = [
  { key: 'whole', label: 'Whole job' },
  { key: 'pipe', label: 'Pipe & fittings' },
  { key: 'fixtures', label: 'Fixtures & equipment' },
  { key: 'custom', label: 'Custom' },
]

export function PrepareFixtureCopyModal({
  open,
  onClose,
  bidLabel,
  rows,
  quoteLink,
  onRfqMinted,
  onSendByEmail,
}: {
  open: boolean
  onClose: () => void
  bidLabel: string
  rows: PrepareCopyRow[]
  /**
   * RFQ Phase 2 (v2.2631): when set, the footer offers "Copy with quote link" —
   * mints a bid_rfqs row (scope = the current selection) and appends a public
   * /q/<token> link to the paste. Omit for roles that can't write RFQs.
   */
  quoteLink?: { bidId: string; bidVersionId: string | null }
  /** Fires after a quote link is minted (so the caller can refresh its RFQ chip). */
  onRfqMinted?: () => void
  /**
   * Lane B (v2.2636): hand the current selection to the RFQ compose — the
   * desk emails it with per-house links. Scope stays decided HERE.
   */
  onSendByEmail?: (scope: { lines: Array<{ fixture: string; count: number; unit?: string | null }>; text: string }) => void
}) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ruleRows, setRuleRows] = useState<RuleRow[]>([])
  const [sections, setSections] = useState<Array<{ code: string; title: string }>>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [pinBusy, setPinBusy] = useState<string | null>(null)
  // Quote-link lane state (only used when `quoteLink` is provided).
  const [houses, setHouses] = useState<Array<{ id: string; name: string }>>([])
  const [linkHouseId, setLinkHouseId] = useState('')
  const [linkNeededBy, setLinkNeededBy] = useState('')
  const [minting, setMinting] = useState(false)
  // Phase 3 (v2.2632): the picked house's name-keyed price memory — powers the
  // "last quoted N of these items" recency hint under the quote-link strip.
  const [houseMemory, setHouseMemory] = useState<{ keys: Set<string>; newest: string | null } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [rules, sectionRows] = await Promise.all([
        withSupabaseRetry(
          () => supabase.from('spec_section_match_rules').select('id, pattern, match_kind, section_code, priority'),
          'load spec section match rules',
        ),
        withSupabaseRetry(() => supabase.from('spec_sections').select('code, title').order('code'), 'load spec sections'),
      ])
      setRuleRows(rules ?? [])
      setSections(sectionRows ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the Division 22 ledger.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setFilter('')
    setPicked({})
    setLinkHouseId('')
    setLinkNeededBy('')
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open || !quoteLink) return
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.from('supply_houses').select('id, name').order('name'),
          'load supply houses',
        )
        if (!cancelled) setHouses((data ?? []).map((h) => ({ id: h.id, name: h.name })))
      } catch {
        if (!cancelled) setHouses([])
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id, not the object identity (callers pass inline objects)
  }, [open, quoteLink?.bidId])

  useEffect(() => {
    if (!open || !linkHouseId) {
      setHouseMemory(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.from('supply_house_fixture_prices').select('fixture_key, quoted_at').eq('supply_house_id', linkHouseId),
          'load house price memory',
        )
        if (cancelled) return
        const keys = new Set<string>()
        let newest: string | null = null
        for (const r of data ?? []) {
          if (r.fixture_key) keys.add(r.fixture_key)
          if (r.quoted_at && (newest == null || r.quoted_at > newest)) newest = r.quoted_at
        }
        setHouseMemory({ keys, newest })
      } catch {
        if (!cancelled) setHouseMemory(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, linkHouseId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const matchRules: SpecSectionMatchRule[] = useMemo(
    () =>
      ruleRows
        .filter((r) => KNOWN_KINDS.has(r.match_kind))
        .map((r) => ({ pattern: r.pattern, matchKind: r.match_kind as SpecSectionMatchKind, sectionCode: r.section_code, priority: r.priority })),
    [ruleRows],
  )
  const sectionTitleByCode = useMemo(() => new Map(sections.map((s) => [s.code, s.title])), [sections])
  const groups = useMemo(() => buildPrepareCopyGroups(rows, matchRules, sectionTitleByCode), [rows, matchRules, sectionTitleByCode])
  const allIds = useMemo(() => new Set(groups.flatMap((g) => g.rows.map((r) => r.id))), [groups])

  // Everything selected on open (and when the ledger finishes loading regroups the rows).
  useEffect(() => {
    if (!open) return
    setSelected(new Set(allIds))
  }, [open, allIds])

  const scope = useMemo(() => scopeForSelection(groups, selected), [groups, selected])
  const copyText = useMemo(
    () => buildScopedFixtureCopyText({ bidLabel, groups, selected, sectionTitleByCode }),
    [bidLabel, groups, selected, sectionTitleByCode],
  )

  /** This bid's genuinely unmatched names (deliberate no-code rules don't count). */
  const uncodedNames = useMemo(() => {
    const names = new Set<string>()
    for (const row of rows) {
      const name = (row.fixture ?? '').trim()
      if (!name || !Number.isFinite(row.count) || row.count <= 0) continue
      if (classifySpecSection(name, matchRules).outcome === 'unmatched') names.add(name)
    }
    return [...names]
  }, [rows, matchRules])

  const sectionOptions: SearchableSelectOption[] = useMemo(
    () => sections.map((s) => ({ value: s.code, label: `${s.code} · ${s.title}` })),
    [sections],
  )

  function applyScope(next: PrepareCopyScope) {
    const ids = rowIdsForScope(groups, next)
    if (ids) setSelected(ids)
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(g: { rows: PrepareCopyRow[] }, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of g.rows) {
        if (on) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })
  }

  async function pin(name: string, sectionCode: string | null) {
    setPinBusy(name)
    try {
      const existing = ruleRows.find((r) => r.match_kind === 'exact' && r.pattern.trim().toLowerCase() === name.toLowerCase())
      if (existing) {
        const { error } = await supabase
          .from('spec_section_match_rules')
          .update({ section_code: sectionCode, priority: AUDIT_PIN_PRIORITY })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('spec_section_match_rules')
          .insert({ pattern: name, match_kind: 'exact', section_code: sectionCode, priority: AUDIT_PIN_PRIORITY })
        if (error) throw error
      }
      const rules = await withSupabaseRetry(
        () => supabase.from('spec_section_match_rules').select('id, pattern, match_kind, section_code, priority'),
        'reload spec section match rules',
      )
      setRuleRows(rules ?? [])
      setPicked((p) => {
        const next = { ...p }
        delete next[name]
        return next
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the rule.', 'error')
    } finally {
      setPinBusy(null)
    }
  }

  async function copy(text: string, itemCount: number) {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('Clipboard unavailable in this browser.')
      await navigator.clipboard.writeText(text)
      showToast(`Copied ${itemCount} of ${allIds.size} items — grouped by Division 22, no prices.`, 'success')
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not copy to clipboard.', 'error')
    }
  }

  /**
   * Copy with quote link: mints a bid_rfqs row whose scope snapshot is the
   * current selection, then copies the same paste with a public /q/<token>
   * line appended. The vendor types prices into that page instead of texting
   * them back.
   */
  async function copyWithQuoteLink() {
    if (!quoteLink || !linkHouseId || selected.size === 0) return
    setMinting(true)
    try {
      const token = crypto.randomUUID().replace(/-/g, '')
      const scopeLines = rows
        .filter((r) => selected.has(r.id) && Number.isFinite(r.count) && r.count > 0)
        .map((r) => ({ fixture: r.fixture, count: r.count, unit: r.unit ?? null }))
      const houseName = houses.find((h) => h.id === linkHouseId)?.name ?? null
      const { error } = await supabase.from('bid_rfqs').insert({
        bid_id: quoteLink.bidId,
        bid_version_id: quoteLink.bidVersionId,
        supply_house_id: linkHouseId,
        sent_to: houseName,
        scope: { lines: scopeLines },
        needed_by: linkNeededBy || null,
        token,
        status: 'sent',
      })
      if (error) throw error
      const text = `${copyText}\n\nPrice it here: https://clicktooling.com/q/${token}`
      if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('Clipboard unavailable in this browser.')
      await navigator.clipboard.writeText(text)
      showToast(`Copied ${selected.size} items + a quote link for ${houseName ?? 'the vendor'} — prices they type land on this bid.`, 'success')
      onRfqMinted?.()
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create the quote link.', 'error')
    } finally {
      setMinting(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const filterNeedle = filter.trim().toLowerCase()
  const chip = (on: boolean): CSSProperties => ({
    padding: '0.3rem 0.8rem',
    borderRadius: 999,
    border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`,
    background: on ? '#2563eb' : 'var(--surface)',
    color: on ? 'white' : 'var(--text-strong)',
    font: 'inherit',
    fontSize: '0.8125rem',
    fontWeight: on ? 600 : 400,
    cursor: 'pointer',
  })
  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

  return createPortal(
    <div
      style={overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Supply house list" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Supply house list</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {bidLabel} · scope it to the vendor, fix codes, and the preview is exactly what you’ll paste.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Running the rows through the ledger…</p>
        ) : loadError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{loadError}</p>
            <button type="button" onClick={() => void load()} style={{ padding: '0.35rem 0.8rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
              Retry
            </button>
            <button
              type="button"
              onClick={() => void copy(buildBidFixtureCountsText({ bidLabel, rows }), rows.filter((r) => Number.isFinite(r.count) && r.count > 0).length)}
              style={{ padding: '0.35rem 0.8rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontWeight: 600 }}
            >
              Copy the flat list anyway
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ ...smallMuted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.7rem' }}>Scope</span>
              {SCOPES.map((s) => (
                <button key={s.key} type="button" style={chip(scope === s.key)} onClick={() => applyScope(s.key)} disabled={s.key === 'custom'}>
                  {s.label}
                </button>
              ))}
              <span style={smallMuted}>presets tick whole sections — any checkbox switches to Custom.</span>
            </div>

            {uncodedNames.length > 0 ? (
              <div style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-yellow-tint)', borderRadius: 6, padding: '0.5rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-amber-700)' }}>
                  {uncodedNames.length} name{uncodedNames.length === 1 ? '' : 's'} on this bid need a code — pins fix every bid
                </span>
                {uncodedNames.slice(0, 3).map((name) => (
                  <div key={name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.8fr) auto auto', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{name}</span>
                    <SearchableSelect
                      value={picked[name] ?? ''}
                      onChange={(v) => setPicked((p) => ({ ...p, [name]: v }))}
                      options={sectionOptions}
                      placeholder="pick a section…"
                      portalZIndex={MODAL_Z + 10}
                      fillViewportHeight
                      listMinWidthPx={470}
                    />
                    <button
                      type="button"
                      disabled={!picked[name] || pinBusy === name}
                      onClick={() => void pin(name, picked[name] ?? null)}
                      style={{ padding: '0.3rem 0.75rem', background: picked[name] ? '#16a34a' : 'var(--bg-200)', color: picked[name] ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, cursor: picked[name] ? 'pointer' : 'not-allowed', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {pinBusy === name ? 'Pinning…' : 'Pin it'}
                    </button>
                    <button
                      type="button"
                      disabled={pinBusy === name}
                      onClick={() => void pin(name, null)}
                      title="Deliberately no Division 22 code (like DEMO)"
                      style={{ padding: '0.3rem 0.65rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                    >
                      No code
                    </button>
                  </div>
                ))}
                {uncodedNames.length > 3 ? <span style={smallMuted}>…{uncodedNames.length - 3} more in the No-code group below, or the full audit (Share ▾ → Division 22 codes).</span> : null}
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: '0.9rem', alignItems: 'start' }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>What goes</span>
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="filter rows…"
                    style={{ flex: 1, maxWidth: 200, padding: '0.2rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
                  />
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setSelected(new Set(allIds))} style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', padding: 0 }}>All</button>
                    <button type="button" onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', padding: 0 }}>None</button>
                  </span>
                </div>
                <div style={{ maxHeight: '48vh', overflowY: 'auto' }}>
                  {groups.map((g) => {
                    const visibleRows = filterNeedle
                      ? g.rows.filter((r) => (r.fixture ?? '').toLowerCase().includes(filterNeedle))
                      : g.rows
                    if (filterNeedle && visibleRows.length === 0) return null
                    const inCount = g.rows.filter((r) => selected.has(r.id)).length
                    const allOn = inCount === g.rows.length
                    return (
                      <div key={g.sectionCode ?? '__tail'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                          <input type="checkbox" checked={allOn} onChange={(e) => toggleGroup(g, e.target.checked)} aria-label={`Include section ${g.sectionCode ?? 'No code yet'}`} />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: inCount === 0 ? 'var(--text-faint)' : 'var(--text-strong)' }}>
                            {g.sectionCode ? `${g.sectionCode}${g.title ? ` · ${g.title}` : ''}` : 'No code yet'}
                          </span>
                          <span style={{ marginLeft: 'auto', ...smallMuted }}>{inCount} of {g.rows.length} in</span>
                        </div>
                        {visibleRows.map((r) => (
                          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.22rem 0.75rem 0.22rem 1.6rem', borderBottom: '1px solid var(--bg-muted)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: selected.has(r.id) ? 'var(--text-strong)' : 'var(--text-faint)', overflowWrap: 'anywhere' }}>{r.fixture}</span>
                            <span style={{ marginLeft: 'auto', ...smallMuted }}>{r.count}{(r.unit ?? '').trim() ? ` ${(r.unit ?? '').trim()}` : ''}</span>
                          </label>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0.35rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Exactly what you’ll paste</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>updates live</span>
                </div>
                <pre style={{ margin: 0, padding: '0.7rem 0.85rem', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-strong)', background: 'var(--surface)', flex: 1, overflow: 'auto', maxHeight: '48vh', whiteSpace: 'pre-wrap' }}>{copyText}</pre>
              </div>
            </div>

            {quoteLink ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)' }}>
                <span style={{ ...smallMuted, fontWeight: 600 }}>Want prices typed straight into ClickTooling?</span>
                <SearchableSelect
                  options={houses.map((h): SearchableSelectOption => ({ value: h.id, label: h.name }))}
                  value={linkHouseId}
                  onChange={(v) => setLinkHouseId(v)}
                  placeholder="pick the supply house…"
                  portalZIndex={MODAL_Z + 10}
                  fillViewportHeight
                />
                <label style={{ ...smallMuted, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  needed by
                  <input type="date" value={linkNeededBy} onChange={(e) => setLinkNeededBy(e.target.value)} style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }} />
                </label>
                <button
                  type="button"
                  disabled={minting || !linkHouseId || selected.size === 0}
                  title={!linkHouseId ? 'Pick the supply house the link is for' : 'Copies the same list with a public page link — the vendor types prices there'}
                  onClick={() => void copyWithQuoteLink()}
                  style={{ padding: '0.4rem 0.9rem', background: !linkHouseId || selected.size === 0 ? 'var(--bg-200)' : '#2563eb', color: !linkHouseId || selected.size === 0 ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: minting || !linkHouseId || selected.size === 0 ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }}
                >
                  {minting ? 'Minting link…' : 'Copy with quote link'}
                </button>
                {onSendByEmail ? (
                  <button
                    type="button"
                    disabled={selected.size === 0}
                    title="Email this scope to supply houses — you preview every email before it sends"
                    onClick={() =>
                      onSendByEmail({
                        lines: rows
                          .filter((r) => selected.has(r.id) && Number.isFinite(r.count) && r.count > 0)
                          .map((r) => ({ fixture: r.fixture ?? '', count: r.count, unit: r.unit ?? null }))
                          .filter((l) => l.fixture),
                        text: copyText,
                      })
                    }
                    style={{ padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', color: selected.size === 0 ? 'var(--text-faint)' : 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: selected.size === 0 ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }}
                  >
                    Send by email…
                  </button>
                ) : null}
                {houseMemory && linkHouseId ? (() => {
                  const selectedNames = rows.filter((r) => selected.has(r.id))
                  const known = selectedNames.filter((r) => houseMemory.keys.has((r.fixture ?? '').trim().toLowerCase())).length
                  const houseName = houses.find((h) => h.id === linkHouseId)?.name ?? 'This house'
                  if (known === 0) return <span style={{ ...smallMuted, width: '100%' }}>{houseName} hasn’t quoted any of these items before.</span>
                  const days = houseMemory.newest ? Math.max(0, Math.floor((Date.now() - new Date(houseMemory.newest).getTime()) / 86_400_000)) : null
                  return (
                    <span style={{ ...smallMuted, width: '100%' }}>
                      {houseName} has last-quoted prices for <strong style={{ color: 'var(--text-strong)' }}>{known} of these {selectedNames.length} items</strong>
                      {days != null ? ` · newest ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}` : ''} — you’ll see them beside the reply.
                    </span>
                  )
                })() : null}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
              <span style={smallMuted}>
                Copying <strong style={{ color: 'var(--text-strong)' }}>{selected.size} of {allIds.size} items</strong> · scope and exclusions are per-copy — the bid is untouched. Pins are forever.
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={onClose} style={{ padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
                  Cancel
                </button>
                <button
                  type="button"
                  autoFocus
                  disabled={selected.size === 0}
                  onClick={() => void copy(copyText, selected.size)}
                  style={{ padding: '0.5rem 1.1rem', background: selected.size === 0 ? 'var(--bg-200)' : '#16a34a', color: selected.size === 0 ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: selected.size === 0 ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
                >
                  Copy {selected.size} item{selected.size === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
