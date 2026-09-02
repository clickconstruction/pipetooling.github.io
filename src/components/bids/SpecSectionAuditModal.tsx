/**
 * "Division 22 codes" audit modal (v2.2598) — opened from the Pricing tab's
 * Share ▾ menu by ledger-writer roles. Every distinct fixture name ever counted
 * (RPC `spec_section_fixture_name_audit`) is classified through the rules
 * ledger; uncoded names sit on top sorted by how many bids they touch. Pinning
 * a name writes an exact rule (`AUDIT_PIN_PRIORITY`) — no bid data is edited,
 * and every past and future bid picks the code up instantly. "No code" pins an
 * exact rule with a NULL section (the DEMO pattern), so the name stops counting
 * as a gap without ever getting a section.
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import { type SpecSectionMatchKind, type SpecSectionMatchRule } from '../../lib/classifySpecSection'
import {
  AUDIT_PIN_PRIORITY,
  buildFixtureNameAudit,
  type FixtureNameAudit,
  type FixtureNameAuditRow,
} from '../../lib/specSectionAudit'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { fetchAllRows } from '../../lib/supabasePaging'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

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
  maxWidth: 860,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.25rem 1.25rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
}

type RuleRow = { id: string; pattern: string; match_kind: string; section_code: string | null; priority: number }
type SectionRow = { code: string; title: string }

const KNOWN_KINDS = new Set<string>(['starts_with', 'contains', 'exact'])
const UNCODED_PAGE = 75

function toMatchRules(rows: ReadonlyArray<RuleRow>): SpecSectionMatchRule[] {
  return rows
    .filter((r) => KNOWN_KINDS.has(r.match_kind))
    .map((r) => ({
      pattern: r.pattern,
      matchKind: r.match_kind as SpecSectionMatchKind,
      sectionCode: r.section_code,
      priority: r.priority,
    }))
}

export function SpecSectionAuditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [names, setNames] = useState<Array<{ fixture: string; bidCount: number }>>([])
  const [ruleRows, setRuleRows] = useState<RuleRow[]>([])
  const [sections, setSections] = useState<SectionRow[]>([])
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [pinBusy, setPinBusy] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [showCoded, setShowCoded] = useState(false)
  // Historic naming is varied — the uncoded list can run to many hundreds of rows,
  // each with its own select. Render in slabs so the modal opens instantly.
  const [uncodedShown, setUncodedShown] = useState(UNCODED_PAGE)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [auditRows, rules, sectionRows] = await Promise.all([
        // The audit spans every distinct name ever counted — thousands of rows,
        // past PostgREST's silent 1000-row cap, so an un-ranged read computes
        // coverage against an arbitrary top slice. The RPC's ORDER BY is
        // deterministic (bid_count DESC, fixture ASC), so .range() pages are stable.
        fetchAllRows(
          async (from, to) => ({
            data: await withSupabaseRetry(
              () => supabase.rpc('spec_section_fixture_name_audit').range(from, to),
              'load fixture name audit',
            ),
            error: null,
          }),
          'load fixture name audit',
        ),
        withSupabaseRetry(
          () => supabase.from('spec_section_match_rules').select('id, pattern, match_kind, section_code, priority'),
          'load spec section match rules',
        ),
        withSupabaseRetry(() => supabase.from('spec_sections').select('code, title').order('code'), 'load spec sections'),
      ])
      setNames(auditRows.map((r) => ({ fixture: r.fixture, bidCount: Number(r.bid_count) })))
      setRuleRows(rules ?? [])
      setSections(sectionRows ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the audit.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
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

  const matchRules = useMemo(() => toMatchRules(ruleRows), [ruleRows])
  const audit: FixtureNameAudit = useMemo(() => buildFixtureNameAudit(names, matchRules), [names, matchRules])

  const sectionOptions: SearchableSelectOption[] = useMemo(
    () => sections.map((s) => ({ value: s.code, label: `${s.code} · ${s.title}` })),
    [sections],
  )

  /** Pin = exact rule for this name. sectionCode null → deliberate "No code". */
  async function pin(row: FixtureNameAuditRow, sectionCode: string | null) {
    setPinBusy(row.fixture)
    setPinError(null)
    try {
      // A stale exact rule for this name (e.g. re-pinning after a wrong pick) is updated, not duplicated.
      const existing = ruleRows.find(
        (r) => r.match_kind === 'exact' && r.pattern.trim().toLowerCase() === row.fixture.toLowerCase(),
      )
      if (existing) {
        const { error } = await supabase
          .from('spec_section_match_rules')
          .update({ section_code: sectionCode, priority: AUDIT_PIN_PRIORITY })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('spec_section_match_rules').insert({
          pattern: row.fixture,
          match_kind: 'exact',
          section_code: sectionCode,
          priority: AUDIT_PIN_PRIORITY,
        })
        if (error) throw error
      }
      // Refresh rules only — the name list is unchanged; classification re-runs locally.
      const rules = await withSupabaseRetry(
        () => supabase.from('spec_section_match_rules').select('id, pattern, match_kind, section_code, priority'),
        'reload spec section match rules',
      )
      setRuleRows(rules ?? [])
      setPicked((p) => {
        const next = { ...p }
        delete next[row.fixture]
        return next
      })
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Could not save the rule.')
    } finally {
      setPinBusy(null)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const rowGrid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) 5rem minmax(0, 1.7fr) auto auto',
    gap: '0.5rem',
    alignItems: 'center',
    padding: '0.4rem 0.6rem',
    borderBottom: '1px solid var(--border)',
  }

  return createPortal(
    <div
      style={overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Division 22 codes" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Division 22 codes</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Every fixture name you’ve ever counted, run through the ledger. Pinning writes an exact rule — no bid data is
              edited, and every old bid picks it up instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading every fixture name…</p>
        ) : loadError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              style={{ padding: '0.35rem 0.8rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: 10, background: 'var(--bg-muted)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ width: `${audit.coveragePct}%`, height: '100%', background: '#16a34a' }} />
              </div>
              <span style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>
                <span style={{ fontWeight: 700, color: '#15803d' }}>{audit.codedCount} coded</span>
                {' · '}
                <span style={{ fontWeight: 700, color: 'var(--text-amber-700)' }}>{audit.uncodedCount} uncoded</span>
                {' · '}
                {audit.coveragePct}%
              </span>
            </div>
            {pinError ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{pinError}</p> : null}

            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ ...rowGrid, background: 'var(--bg-subtle)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <span>Fixture name</span>
                <span>Seen on</span>
                <span>Division 22 section</span>
                <span></span>
                <span></span>
              </div>
              <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
                {audit.uncoded.length === 0 ? (
                  <p style={{ margin: 0, padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Every name has a code (or a deliberate “no code”). Nothing to pin.
                  </p>
                ) : (
                  audit.uncoded.slice(0, uncodedShown).map((row) => (
                    <div key={row.fixture} style={{ ...rowGrid, background: 'var(--bg-yellow-tint)' }}>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{row.fixture}</span>
                      <span style={smallMuted}>{row.bidCount} bid{row.bidCount === 1 ? '' : 's'}</span>
                      <SearchableSelect
                        value={picked[row.fixture] ?? ''}
                        onChange={(v) => setPicked((p) => ({ ...p, [row.fixture]: v }))}
                        options={sectionOptions}
                        placeholder="pick a section…"
                        portalZIndex={MODAL_Z + 10}
                        fillViewportHeight
                        listMinWidthPx={470}
                      />
                      <button
                        type="button"
                        disabled={!picked[row.fixture] || pinBusy === row.fixture}
                        onClick={() => void pin(row, picked[row.fixture] ?? null)}
                        style={{
                          padding: '0.35rem 0.8rem',
                          background: picked[row.fixture] ? '#16a34a' : 'var(--bg-200)',
                          color: picked[row.fixture] ? 'white' : 'var(--text-faint)',
                          border: 'none',
                          borderRadius: 4,
                          cursor: picked[row.fixture] ? 'pointer' : 'not-allowed',
                          font: 'inherit',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pinBusy === row.fixture ? 'Pinning…' : 'Pin it'}
                      </button>
                      <button
                        type="button"
                        disabled={pinBusy === row.fixture}
                        onClick={() => void pin(row, null)}
                        title="This name deliberately gets no Division 22 code (like DEMO) — it stops counting as a gap."
                        style={{ padding: '0.35rem 0.7rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                      >
                        No code
                      </button>
                    </div>
                  ))
                )}

                {audit.uncoded.length > uncodedShown ? (
                  <button
                    type="button"
                    onClick={() => setUncodedShown((n) => n + UNCODED_PAGE)}
                    style={{ display: 'block', width: '100%', padding: '0.5rem', background: 'var(--bg-subtle)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-strong)' }}
                  >
                    Show {Math.min(UNCODED_PAGE, audit.uncoded.length - uncodedShown)} more uncoded names ({audit.uncoded.length - uncodedShown} left)
                  </button>
                ) : null}
                {showCoded
                  ? audit.coded.map((row) => (
                      <div key={row.fixture} style={rowGrid}>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{row.fixture}</span>
                        <span style={smallMuted}>{row.bidCount} bid{row.bidCount === 1 ? '' : 's'}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
                          {row.outcome === 'no-code' ? (
                            <span style={{ color: 'var(--text-muted)' }}>no code (deliberate)</span>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{row.sectionCode}</span>
                          )}
                          {row.ruleLabel ? <span style={{ color: 'var(--text-muted)' }}> · via “{row.ruleLabel}”</span> : null}
                        </span>
                        <span></span>
                        <span></span>
                      </div>
                    ))
                  : null}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <span style={smallMuted}>Uncoded names first, sorted by how many bids they appear on — pin the top few and coverage jumps.</span>
              <button
                type="button"
                onClick={() => setShowCoded((s) => !s)}
                style={{ padding: '0.35rem 0.8rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
              >
                {showCoded ? 'Hide coded names' : `Show ${audit.codedCount} coded names`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
