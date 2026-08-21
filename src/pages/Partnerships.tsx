import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  DEFAULT_PARTNERSHIP_MODULES,
  PARTNERSHIP_STATUSES,
  buildConfigPatch,
  normalizeModules,
  validatePartnershipConfig,
  type PartnershipConfig,
  type PartnershipModules,
} from '../lib/partnerLedger/partnershipConfig'
import type { Database, Json } from '../types/database'
import { DashboardPartnerLedgerSection } from '../components/dashboard/DashboardPartnerLedgerSection'
import { DashboardPartnerJobsSection } from '../components/dashboard/DashboardPartnerJobsSection'
import { IMPERSONATION_CHROME_BUTTON_STYLE } from '../lib/impersonationSession'
import { PartnershipJobReviewTab } from '../components/partnerships/PartnershipJobReviewTab'
import { PartnershipStatementsTab } from '../components/partnerships/PartnershipStatementsTab'
import { PartnershipLedgerTab } from '../components/partnerships/PartnershipLedgerTab'
import { PartnershipAgreementsTab } from '../components/partnerships/PartnershipAgreementsTab'
import { PartnershipTimelineTab } from '../components/partnerships/PartnershipTimelineTab'

type PartnershipRow = Database['public']['Tables']['partnerships']['Row']
type PersonOption = { id: string; name: string; kind: string | null }

/**
 * Partnerships — dev-only deal-as-data page (PARTNERSHIPS_PLAN.md PR 1).
 *
 * Left: partnership roster. Right: the selected partnership's Deal tab —
 * rates, split percentages, module toggles, utilities allowance — the whole
 * contract as settings that every downstream kernel/RPC reads. Later PRs in
 * the train add the Agreements / Job review / Statements / Ledger tabs (the
 * tab bar shows them as placeholders so the shape is visible from day one).
 *
 * Fail-soft: if the partnerships migration hasn't been pushed yet, the load
 * errors are swallowed into an explanatory banner — client and migration can
 * deploy in either order.
 */

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '1rem',
}

const groupHeadStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  margin: '1.1rem 0 0.25rem',
}

const cfgRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem 0.75rem',
  padding: '0.5rem 0',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.875rem',
}

const numInputStyle: React.CSSProperties = {
  width: '6.5rem',
  padding: '0.3rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
}

function rowToConfig(row: PartnershipRow): PartnershipConfig {
  return {
    status: row.status,
    started_on: row.started_on,
    field_rate: Number(row.field_rate),
    estimating_rate: Number(row.estimating_rate),
    farm_rate: Number(row.farm_rate),
    company_first_pct: Number(row.company_first_pct),
    partner_remainder_pct: Number(row.partner_remainder_pct),
    utilities_allowance: Number(row.utilities_allowance),
    modules: normalizeModules(row.modules),
  }
}

function Toggle({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        border: '1px solid',
        borderColor: on ? '#16a34a' : 'var(--border-strong)',
        background: on ? '#16a34a' : 'var(--bg-muted)',
        position: 'relative',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        padding: 0,
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? 'var(--surface)' : 'var(--text-muted)',
        }}
      />
    </button>
  )
}

export default function Partnerships() {
  const { role, user: authUser } = useAuth()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<PartnershipRow[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Ledger is the landing tab — the money story is what the page opens on.
  const [activeTab, setActiveTab] = useState<'deal' | 'agr' | 'review' | 'stmts' | 'timeline' | 'ledger'>('ledger')
  const [lensOn, setLensOn] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<PartnershipConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addPersonId, setAddPersonId] = useState('')
  const [addCompany, setAddCompany] = useState('')
  const [farmJobLabel, setFarmJobLabel] = useState<string | null>(null)
  const [farmSearch, setFarmSearch] = useState('')
  const [farmResults, setFarmResults] = useState<{ id: string; label: string }[]>([])
  const [farmBusy, setFarmBusy] = useState(false)

  const load = useCallback(async () => {
    const [pRes, peopleRes] = await Promise.all([
      supabase.from('partnerships').select('*').order('created_at', { ascending: true }),
      supabase.from('people').select('id, name, kind, archived_at').is('archived_at', null).order('name'),
    ])
    if (pRes.error) {
      // 42P01 = relation does not exist → migration not pushed yet. Fail soft.
      setTableMissing(true)
      setRows([])
    } else {
      setTableMissing(false)
      setRows(pRes.data ?? [])
    }
    setPeople(
      ((peopleRes.data ?? []) as (PersonOption & { archived_at: string | null })[]).map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
      })),
    )
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null, [rows, selectedId])

  useEffect(() => {
    setDraft(selected ? rowToConfig(selected) : null)
    setSaveError(null)
    setSavedAt(null)
    setLensOn(false)
    setFarmSearch('')
    setFarmResults([])
    // Resolve the farm job's display label (§1c anchor).
    const farmId = selected?.farm_job_ledger_id ?? null
    if (!farmId) {
      setFarmJobLabel(null)
    } else {
      void supabase
        .from('jobs_ledger')
        .select('hcp_number, click_number, job_name')
        .eq('id', farmId)
        .single()
        .then(({ data }) => {
          const j = data as { hcp_number: string | null; click_number: string | null; job_name: string | null } | null
          setFarmJobLabel(j ? j.hcp_number?.trim() || j.click_number?.trim() || j.job_name?.trim() || farmId : farmId)
        })
    }
  }, [selected])

  const validationErrors = useMemo(() => (draft ? validatePartnershipConfig(draft) : []), [draft])
  const dirty = useMemo(
    () => (selected && draft ? Object.keys(buildConfigPatch(rowToConfig(selected), draft)).length > 0 : false),
    [selected, draft],
  )

  const availablePeople = useMemo(() => {
    const taken = new Set(rows.map((r) => r.person_id))
    return people.filter((p) => !taken.has(p.id))
  }, [people, rows])

  if (role != null && role !== 'dev') {
    return <Navigate to="/dashboard" replace />
  }

  async function save() {
    if (!selected || !draft || validationErrors.length > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const patch = buildConfigPatch(rowToConfig(selected), draft)
      if (Object.keys(patch).length === 0) return
      await withSupabaseRetry(
        async () =>
          supabase
            .from('partnerships')
            .update({
              status: draft.status,
              started_on: draft.started_on,
              field_rate: draft.field_rate,
              estimating_rate: draft.estimating_rate,
              farm_rate: draft.farm_rate,
              company_first_pct: draft.company_first_pct,
              partner_remainder_pct: draft.partner_remainder_pct,
              utilities_allowance: draft.utilities_allowance,
              modules: draft.modules,
              updated_at: new Date().toISOString(),
              updated_by: authUser?.id ?? null,
            })
            .eq('id', selected.id)
            .select('id')
            .single(),
        'save partnership config',
      )
      // Change log — best effort, never fails the save.
      const eventType = 'status' in patch && Object.keys(patch).length === 1 ? 'status_changed' : 'config_changed'
      await supabase.from('partnership_events').insert({
        partnership_id: selected.id,
        event_type: eventType,
        patch: patch as unknown as Json,
        actor_user_id: authUser?.id ?? null,
      })
      setSavedAt(new Date().toLocaleTimeString())
      await load()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function addPartnership() {
    const person = people.find((p) => p.id === addPersonId)
    if (!person) return
    setSaving(true)
    setSaveError(null)
    try {
      const inserted = await withSupabaseRetry(
        async () =>
          supabase
            .from('partnerships')
            .insert({
              person_id: person.id,
              display_name: person.name,
              company_name: addCompany.trim(),
              status: 'draft',
              modules: DEFAULT_PARTNERSHIP_MODULES,
              created_by: authUser?.id ?? null,
              updated_by: authUser?.id ?? null,
            })
            .select('id')
            .single(),
        'create partnership',
      )
      const newId = (inserted as { id?: string } | null)?.id
      if (typeof newId === 'string') {
        await supabase.from('partnership_events').insert({
          partnership_id: newId,
          event_type: 'created',
          patch: { person_name: { from: null, to: person.name } },
          actor_user_id: authUser?.id ?? null,
        })
        setSelectedId(newId)
      }
      setAddOpen(false)
      setAddPersonId('')
      setAddCompany('')
      await load()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not create partnership')
    } finally {
      setSaving(false)
    }
  }

  async function searchFarmJobs(q: string) {
    setFarmSearch(q)
    const term = q.trim()
    if (term.length < 2) {
      setFarmResults([])
      return
    }
    const { data } = await supabase
      .from('jobs_ledger')
      .select('id, hcp_number, click_number, job_name')
      .or(`hcp_number.ilike.%${term}%,click_number.ilike.%${term}%,job_name.ilike.%${term}%`)
      .limit(8)
    setFarmResults(
      ((data ?? []) as { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }[]).map((j) => ({
        id: j.id,
        label: [j.hcp_number?.trim() || j.click_number?.trim() || '', j.job_name?.trim() || ''].filter(Boolean).join(' — ') || j.id,
      })),
    )
  }

  async function setFarmJob(jobId: string | null, label: string | null) {
    if (!selected) return
    setFarmBusy(true)
    setSaveError(null)
    const { error } = await supabase
      .from('partnerships')
      .update({ farm_job_ledger_id: jobId, updated_at: new Date().toISOString(), updated_by: authUser?.id ?? null })
      .eq('id', selected.id)
    if (error) {
      setSaveError(error.message)
    } else {
      await supabase.from('partnership_events').insert({
        partnership_id: selected.id,
        event_type: 'config_changed',
        patch: { farm_job_ledger_id: { from: selected.farm_job_ledger_id ?? null, to: jobId } } as unknown as Json,
        actor_user_id: authUser?.id ?? null,
      })
      setFarmJobLabel(label)
      setFarmSearch('')
      setFarmResults([])
      await load()
    }
    setFarmBusy(false)
  }

  function setModule(key: keyof PartnershipModules, value: boolean) {
    setDraft((d) => (d ? { ...d, modules: { ...d.modules, [key]: value } } : d))
  }

  const statusChip = (status: string) => {
    const fallback = { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }
    const map: Record<string, { bg: string; fg: string }> = {
      active: { bg: 'var(--bg-subtle)', fg: '#16a34a' },
      draft: fallback,
      paused: { bg: 'var(--bg-subtle)', fg: '#d97706' },
      ended: { bg: 'var(--bg-muted)', fg: '#dc2626' },
    }
    const c = map[status] ?? fallback
    return (
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          padding: '0.1rem 0.5rem',
          borderRadius: 999,
          background: c.bg,
          color: c.fg,
          border: '1px solid var(--border)',
        }}
      >
        {status}
      </span>
    )
  }

  const cfgRow = (label: string, sub: string, control: React.ReactNode) => (
    <div style={cfgRowStyle}>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      {control}
    </div>
  )

  const numField = (
    value: number,
    onChange: (n: number) => void,
    opts?: { suffix?: string; step?: string },
  ) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
      <input
        type="number"
        inputMode="decimal"
        step={opts?.step ?? '0.01'}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        style={numInputStyle}
      />
      {opts?.suffix ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opts.suffix}</span> : null}
    </span>
  )

  const addForm = addOpen ? (
    <div style={{ padding: '0.35rem 0.6rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <select
        value={addPersonId}
        onChange={(e) => setAddPersonId(e.target.value)}
        style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.3rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
      >
        <option value="">Pick a person…</option>
        {availablePeople.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.kind === 'sub' ? ' (sub)' : ''}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Company name (optional)"
        value={addCompany}
        onChange={(e) => setAddCompany(e.target.value)}
        style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
      />
      <button
        type="button"
        onClick={() => void addPartnership()}
        disabled={!addPersonId || saving}
        style={{ font: 'inherit', fontSize: '0.85rem', fontWeight: 650, padding: '0.35rem 0.6rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', opacity: !addPersonId || saving ? 0.6 : 1 }}
      >
        Create draft partnership
      </button>
    </div>
  ) : null

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Partnerships</h1>
      </div>

      {tableMissing && loaded ? (
        <div
          style={{
            ...cardStyle,
            borderColor: 'var(--border-strong)',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: 'var(--text-700)',
          }}
        >
          The partnerships tables aren’t in the database yet — run <code>supabase db push</code> for migration
          <code> 20260820130000_partnerships.sql</code>, then reload.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 220px) minmax(0, 1fr)', gap: isMobile ? '0.75rem' : '1rem', alignItems: 'start' }}>
        {/* Roster — desktop side card; mobile horizontal chip strip */}
        {isMobile ? (
          <div>
            <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'none' }}>
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    flex: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    font: 'inherit',
                    fontSize: '0.85rem',
                    fontWeight: 650,
                    color: 'inherit',
                    background: selected?.id === r.id ? 'var(--bg-blue-tint)' : 'transparent',
                    border: '1px solid',
                    borderColor: selected?.id === r.id ? 'var(--border-strong)' : 'var(--border)',
                    borderRadius: 999,
                    padding: '0.4rem 0.85rem',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {r.display_name || '(unnamed)'} {statusChip(r.status)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                disabled={tableMissing}
                style={{ flex: 'none', font: 'inherit', fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-link)', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 999, padding: '0.4rem 0.85rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
              >
                + New
              </button>
            </div>
            {rows.length === 0 && loaded && !tableMissing ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>No partnerships yet.</p>
            ) : null}
            {addForm}
          </div>
        ) : (
          <div style={{ ...cardStyle, padding: '0.6rem' }}>
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  background: selected?.id === r.id ? 'var(--bg-blue-tint)' : 'transparent',
                  border: '1px solid',
                  borderColor: selected?.id === r.id ? 'var(--border-strong)' : 'transparent',
                  borderRadius: 6,
                  padding: '0.5rem 0.6rem',
                  marginBottom: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 650, fontSize: '0.875rem' }}>{r.display_name || '(unnamed)'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {r.company_name || '—'} {statusChip(r.status)}
                </div>
              </button>
            ))}
            {rows.length === 0 && loaded && !tableMissing ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0.35rem 0.5rem' }}>
                No partnerships yet.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              disabled={tableMissing}
              style={{
                font: 'inherit',
                fontSize: '0.85rem',
                fontWeight: 650,
                color: 'var(--text-link)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.35rem 0.6rem',
              }}
            >
              + New partnership
            </button>
            {addForm}
          </div>
        )}

        {/* Detail */}
        <div style={cardStyle}>
          {!selected || !draft ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
              {loaded ? 'Select or create a partnership.' : 'Loading…'}
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    {selected.display_name}
                    {selected.company_name ? ` — ${selected.company_name}` : ''}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    linked to people record ✓ · created {new Date(selected.created_at).toLocaleDateString()}
                  </div>
                </div>
                {lensOn ? (
                  <span style={{ flex: '1 1 260px', minWidth: 0, fontSize: '0.72rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', border: '1px solid #f59e0b', borderRadius: 8, padding: '0.35rem 0.6rem' }}>
                    <b>Partner view.</b> Only what {selected.display_name || 'the partner'} can see, through the same
                    server gates — read-only. If nothing renders below, their account currently sees nothing (deal
                    paused/ended, or the weekly statement module is off).
                  </span>
                ) : null}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  {statusChip(draft.status)}
                  <button
                    type="button"
                    onClick={() => setLensOn((v) => !v)}
                    style={{ ...IMPERSONATION_CHROME_BUTTON_STYLE, font: 'inherit', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {lensOn ? '✕ Exit partner view' : `👁 View as ${selected.display_name || 'partner'}`}
                  </button>
                </span>
              </div>

              {lensOn ? (
                // Muted ground behind the lens — the dashboard cards are white
                // surfaces that vanish against this page's white detail card in
                // light mode; this recreates the dashboard's page background so
                // their borders read in both themes.
                <div style={{ marginTop: '0.75rem', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.1rem 0.85rem' }}>
                  <DashboardPartnerLedgerSection asPartnershipId={selected.id} />
                  <DashboardPartnerJobsSection asPartnershipId={selected.id} />
                </div>
              ) : (
                <>
              {/* Tab bar — one line always; scrolls sideways on narrow screens */}
              <div style={{ display: 'flex', gap: '0.9rem', borderBottom: '1px solid var(--border)', margin: '0.75rem 0', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {(
                  [
                    ['deal', 'Deal'],
                    ['agr', 'Agreements'],
                    ['review', 'Job review'],
                    ['stmts', 'Statements'],
                    ['timeline', 'Timeline'],
                    ['ledger', 'Ledger'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    style={{
                      flex: 'none',
                      whiteSpace: 'nowrap',
                      font: 'inherit',
                      fontSize: '0.85rem',
                      fontWeight: 650,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 0 0.4rem',
                      color: activeTab === key ? 'var(--text-link)' : 'var(--text-muted)',
                      borderBottom: activeTab === key ? '2px solid var(--text-link)' : '2px solid transparent',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'agr' ? (
                <PartnershipAgreementsTab
                  partnershipId={selected.id}
                  personId={selected.person_id}
                  personName={selected.display_name || 'the partner'}
                  autoNoticeOn={draft.modules.auto_notice}
                />
              ) : activeTab === 'review' ? (
                <PartnershipJobReviewTab partnershipId={selected.id} partnerName={selected.display_name || 'the partner'} />
              ) : activeTab === 'stmts' ? (
                <PartnershipStatementsTab
                  partnershipId={selected.id}
                  personId={selected.person_id}
                  personName={selected.display_name || 'the partner'}
                  weeklyStatementOn={draft.modules.weekly_statement}
                />
              ) : activeTab === 'timeline' ? (
                <PartnershipTimelineTab personId={selected.person_id} personName={selected.display_name || 'the partner'} />
              ) : activeTab === 'ledger' ? (
                <PartnershipLedgerTab personId={selected.person_id} partnershipId={selected.id} />
              ) : (
                <>
              <div style={groupHeadStyle}>Status</div>
              {cfgRow(
                'Partnership status',
                'draft → active when the deal starts; paused/ended stop partner surfaces',
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.3rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
                >
                  {PARTNERSHIP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>,
              )}
              {cfgRow(
                'Started on',
                'the deal’s effective start date',
                <input
                  type="date"
                  value={draft.started_on ?? ''}
                  onChange={(e) => setDraft({ ...draft, started_on: e.target.value || null })}
                  style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.3rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
                />,
              )}

              <div style={groupHeadStyle}>Pay rates</div>
              {cfgRow('Field work', 'customer jobs away from property (§1a)', numField(draft.field_rate, (n) => setDraft({ ...draft, field_rate: n }), { suffix: '/ hr' }))}
              {cfgRow('Estimating / office', 'bid-tagged hours (§1b)', numField(draft.estimating_rate, (n) => setDraft({ ...draft, estimating_rate: n }), { suffix: '/ hr' }))}
              {cfgRow('Farm work', 'logged, unpaid — farm food credit (§1c)', numField(draft.farm_rate, (n) => setDraft({ ...draft, farm_rate: n }), { suffix: '/ hr' }))}
              {cfgRow(
                'Farm job',
                'hours clocked to this job price at the farm rate on statements; unset = no farm bucket',
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end', minWidth: 0 }}>
                  {selected.farm_job_ledger_id ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600 }}>
                      {farmJobLabel ?? '…'}
                      <button
                        type="button"
                        disabled={farmBusy}
                        onClick={() => void setFarmJob(null, null)}
                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 650, border: 'none', background: 'none', color: 'var(--text-red-600)', cursor: 'pointer' }}
                      >
                        clear
                      </button>
                    </span>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search jobs (HCP #, Click #, name)…"
                        value={farmSearch}
                        onChange={(e) => void searchFarmJobs(e.target.value)}
                        style={{ font: 'inherit', fontSize: '0.82rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', width: '15rem', maxWidth: '100%' }}
                      />
                      {farmResults.length > 0 ? (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', width: '15rem', maxWidth: '100%' }}>
                          {farmResults.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              disabled={farmBusy}
                              onClick={() => void setFarmJob(r.id, r.label)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.5rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', cursor: 'pointer' }}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>,
              )}

              <div style={groupHeadStyle}>Profit split (§3)</div>
              {cfgRow('Profit shares', 'post profit splits on close of checked-off jobs', <Toggle on={draft.modules.profit_shares} onClick={() => setModule('profit_shares', !draft.modules.profit_shares)} label="Profit shares" />)}
              {cfgRow('Company first cut', '10% overhead + 12% profit (§3i)', numField(draft.company_first_pct, (n) => setDraft({ ...draft, company_first_pct: n }), { suffix: '%', step: '1' }))}
              {cfgRow('Partner share of remainder', '§3ii', numField(draft.partner_remainder_pct, (n) => setDraft({ ...draft, partner_remainder_pct: n }), { suffix: '%', step: '1' }))}
              {cfgRow('Estimate hours to job at award', 'bid hours × estimating rate → direct expense (§4h)', <Toggle on={draft.modules.est_transfer} onClick={() => setModule('est_transfer', !draft.modules.est_transfer)} label="Estimate hours transfer" />)}

              <div style={groupHeadStyle}>Visibility &amp; statements</div>
              {cfgRow('Weekly statement', 'Sun–Sat, mutual acknowledgment (§4, §9b)', <Toggle on={draft.modules.weekly_statement} onClick={() => setModule('weekly_statement', !draft.modules.weekly_statement)} label="Weekly statement" />)}
              {cfgRow('Job costing transparency', 'checked-off jobs only (§5)', <Toggle on={draft.modules.costing} onClick={() => setModule('costing', !draft.modules.costing)} label="Job costing transparency" />)}
              {cfgRow('Require signed agreement', 'sign prompts + banner until signed', <Toggle on={draft.modules.require_sign} onClick={() => setModule('require_sign', !draft.modules.require_sign)} label="Require signed agreement" />)}
              {cfgRow('Utilities allowance', 'overage posts monthly (§6a)', numField(draft.utilities_allowance, (n) => setDraft({ ...draft, utilities_allowance: n }), { suffix: '/ mo', step: '1' }))}

              <div style={groupHeadStyle}>Optional mechanisms</div>
              {cfgRow('Auto-serve notice on lapse', '§8a — stays off pending Texas-attorney sign-off; lapses queue a drafted notice for manual send', <Toggle on={draft.modules.auto_notice} onClick={() => setModule('auto_notice', !draft.modules.auto_notice)} label="Auto-serve notice" />)}
              {cfgRow('Weekly estimating cap', '§4a, §4c–f — modeled only; nothing is built behind this switch', <Toggle on={draft.modules.cap} onClick={() => setModule('cap', !draft.modules.cap)} label="Weekly estimating cap" />)}
              {cfgRow('W2 transition watch', '§2b — modeled only; nothing is built behind this switch', <Toggle on={draft.modules.w2} onClick={() => setModule('w2', !draft.modules.w2)} label="W2 transition watch" />)}

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>
                Every change is logged. Rate and split changes take effect from the next generated statement week — never
                retroactively; each statement stamps the rates it was priced at. Current rates: {money(draft.field_rate)}
                /hr field · {money(draft.estimating_rate)}/hr estimating.
              </p>

              {validationErrors.length > 0 ? (
                <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-red-600)' }}>
                  {validationErrors.map((e) => (
                    <div key={e}>{e}</div>
                  ))}
                </div>
              ) : null}
              {saveError ? <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-red-600)' }}>{saveError}</div> : null}

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.9rem' }}>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!dirty || saving || validationErrors.length > 0}
                  style={{
                    font: 'inherit',
                    fontSize: '0.875rem',
                    fontWeight: 650,
                    padding: '0.45rem 0.9rem',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    cursor: 'pointer',
                    opacity: !dirty || saving || validationErrors.length > 0 ? 0.55 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                {savedAt ? <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>Saved {savedAt}</span> : null}
                {dirty && !savedAt ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unsaved changes</span> : null}
              </div>
                </>
              )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
