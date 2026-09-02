import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { buildSubsHqRows, groupUnattributedSheets, type SubsHqResult, type UnattributedGroup } from '../../lib/people/subsHqRows'
import { suggestSubSheetAssignee } from '../../lib/people/subSheetNameSuggestion'
import type { ComplianceBadge } from '../../lib/people/subCompliance'
import SubPortalGlobeButton from './SubPortalGlobeButton'

/**
 * People → Subs: one row per subcontractor relationship (RUN_SUBS_PLAN
 * Phase 3, PR 3.4 — Option C of the approved mockups). Merges the roster,
 * junction-attributed sub-sheet balances (identity-plan C1-7 for this
 * surface), open work orders, compliance badges, and a simple track record.
 * Self-contained: loads everything itself under the caller's RLS.
 *
 * The per-sub Documents expander is the compliance micro-editor: set a
 * document's type and expiry here (writes person_contract_documents
 * directly); sending/signing stays on the Contracts tab.
 *
 * The "Unattributed sheets" panel at the top surfaces sheets the junction
 * resolves to no one or to several people, grouped per (job, raw name), with
 * Open → (deep link to Jobs → Sub Labor by sheet id), an Assign… roster
 * picker, and a conservative one-tap suggestion (subSheetNameSuggestion).
 */

type DocRow = {
  id: string
  document_name: string
  doc_type: string
  status: string
  expires_at: string | null
  person_id: string | null
  person_name: string | null
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const BADGE_STYLE: Record<ComplianceBadge['state'], { background: string; color: string }> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-600)' },
  expiring: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  expired: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  missing: { background: 'var(--bg-neutral-100)', color: 'var(--text-muted)' },
}

const DOC_TYPES = ['agreement', 'coi', 'w9', 'license', 'other'] as const

export default function PeopleSubsTab() {
  const navigate = useNavigate()
  const [result, setResult] = useState<SubsHqResult | null>(null)
  const [docsByPerson, setDocsByPerson] = useState<Record<string, DocRow[]>>({})
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingDocId, setSavingDocId] = useState<string | null>(null)
  /** Active sub roster — exactly the population buildSubsHqRows attributes against. */
  const [roster, setRoster] = useState<Array<{ id: string; name: string }>>([])
  const [assignPickerKey, setAssignPickerKey] = useState<string | null>(null)
  const [assignSavingKey, setAssignSavingKey] = useState<string | null>(null)
  const [showAllUnattributed, setShowAllUnattributed] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const [peopleRes, usersRes, sheetsRes, assigneesRes, commitmentsRes, docsRes] = await Promise.all([
      supabase.from('people').select('id, name, archived_at, account_user_id').eq('kind', 'sub'),
      supabase.from('users').select('id, name, email').eq('role', 'subcontractor'),
      supabase.from('people_labor_jobs').select('id, assigned_to_name, address, job_number, labor_rate'),
      supabase.from('people_labor_job_assignees').select('labor_job_id, person_id'),
      supabase.from('step_commitments').select('person_id, amount, status, step_id'),
      supabase
        .from('person_contract_documents')
        .select('id, document_name, doc_type, status, expires_at, person_id, person_name'),
    ])
    const firstError = peopleRes.error ?? usersRes.error ?? sheetsRes.error ?? assigneesRes.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const sheetRows = (sheetsRes.data ?? []) as Array<{ id: string; assigned_to_name: string; address: string; job_number: string | null; labor_rate: number | null }>
    const sheetIds = sheetRows.map((s) => s.id)
    let itemsByJob = new Map<string, Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null; direct_labor_amount?: number | null }>>()
    let paymentsByJob = new Map<string, Array<{ id: string; amount: number; memo: string | null; created_at: string }>>()
    if (sheetIds.length > 0) {
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from('people_labor_job_items').select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', sheetIds),
        supabase.from('people_labor_job_payments').select('id, job_id, amount, memo, created_at').in('job_id', sheetIds),
      ])
      itemsByJob = new Map()
      for (const it of (itemsRes.data ?? []) as Array<{ job_id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null; direct_labor_amount?: number | null }>) {
        ;(itemsByJob.get(it.job_id) ?? itemsByJob.set(it.job_id, []).get(it.job_id)!).push(it)
      }
      paymentsByJob = new Map()
      for (const p of (paymentsRes.data ?? []) as Array<{ id: string; job_id: string; amount: number; memo: string | null; created_at: string }>) {
        ;(paymentsByJob.get(p.job_id) ?? paymentsByJob.set(p.job_id, []).get(p.job_id)!).push({ id: p.id, amount: Number(p.amount), memo: p.memo, created_at: p.created_at })
      }
    }

    // Commitments enriched with step/project names (fail-soft pre-migration).
    const commitmentRows = commitmentsRes.error
      ? []
      : ((commitmentsRes.data ?? []) as Array<{ person_id: string; amount: number; status: string; step_id: string }>)
    const stepInfo = new Map<string, { stepName: string; projectName: string | null }>()
    if (commitmentRows.length > 0) {
      const stepIds = [...new Set(commitmentRows.map((c) => c.step_id))]
      const { data: stepRows } = await supabase
        .from('project_workflow_steps')
        .select('id, name, project_workflows(projects(name))')
        .in('id', stepIds)
      for (const s of (stepRows ?? []) as Array<{ id: string; name: string; project_workflows: { projects: { name: string } | { name: string }[] | null } | { projects: { name: string } | { name: string }[] | null }[] | null }>) {
        const wf = Array.isArray(s.project_workflows) ? s.project_workflows[0] : s.project_workflows
        const proj = wf ? (Array.isArray(wf.projects) ? wf.projects[0] : wf.projects) : null
        stepInfo.set(s.id, { stepName: s.name, projectName: proj?.name ?? null })
      }
    }

    const docRows = docsRes.error ? [] : ((docsRes.data ?? []) as DocRow[])
    const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())

    const activeRoster = ((peopleRes.data ?? []) as Array<{ id: string; name: string; archived_at: string | null }>)
      .filter((p) => !p.archived_at)
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    setRoster(activeRoster)

    setResult(
      buildSubsHqRows({
        people: ((peopleRes.data ?? []) as Array<{ id: string; name: string; archived_at: string | null; account_user_id: string | null }>).map((p) => ({
          id: p.id,
          name: p.name,
          archived: !!p.archived_at,
          accountUserId: p.account_user_id,
        })),
        users: (usersRes.data ?? []) as Array<{ id: string; name: string | null; email: string | null }>,
        sheets: sheetRows.map((s) => ({
          id: s.id,
          label: [s.job_number, s.address].filter(Boolean).join(' · ') || s.assigned_to_name,
          assignedToName: s.assigned_to_name,
          jobNumber: s.job_number,
          labor_rate: s.labor_rate,
          items: itemsByJob.get(s.id) ?? [],
          payments: paymentsByJob.get(s.id) ?? [],
        })),
        assignees: (assigneesRes.data ?? []) as Array<{ labor_job_id: string; person_id: string }>,
        commitments: commitmentRows.map((c) => ({
          person_id: c.person_id,
          amount: Number(c.amount),
          status: c.status,
          stepName: stepInfo.get(c.step_id)?.stepName ?? null,
          projectName: stepInfo.get(c.step_id)?.projectName ?? null,
        })),
        docs: docRows.map((d) => ({ person_id: d.person_id, person_name: d.person_name, doc_type: d.doc_type ?? 'agreement', status: d.status, expires_at: d.expires_at ?? null })),
        todayYmd,
      }),
    )

    const grouped: Record<string, DocRow[]> = {}
    const peopleByNameLower = new Map(
      ((peopleRes.data ?? []) as Array<{ id: string; name: string }>).map((p) => [p.name.trim().toLowerCase(), p.id]),
    )
    for (const d of docRows) {
      const pid = d.person_id ?? (d.person_name ? peopleByNameLower.get(d.person_name.trim().toLowerCase()) : undefined)
      if (!pid) continue
      ;(grouped[pid] ??= []).push(d)
    }
    setDocsByPerson(grouped)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const unattributedGroups = useMemo(
    () => (result ? groupUnattributedSheets(result.unattributed) : []),
    [result],
  )

  /** Conservative one-tap suggestion per unmatched group (null = no safe guess). */
  const suggestionByGroup = useMemo(() => {
    const candidates = roster.map((r) => ({ personId: r.id, name: r.name }))
    const map = new Map<string, { id: string; name: string } | null>()
    for (const g of unattributedGroups) {
      if (g.reason !== 'unmatched') {
        map.set(g.key, null)
        continue
      }
      const hit = suggestSubSheetAssignee(g.rawAssignedTo, candidates)
      map.set(g.key, hit ? { id: hit.personId, name: hit.name } : null)
    }
    return map
  }, [unattributedGroups, roster])

  /**
   * Attribute every sheet in an unattributed group to one roster person.
   * The junction (people_labor_job_assignees) is a trigger-maintained shadow
   * of assigned_to_name (sync_people_labor_job_assignees DELETEs + rebuilds it
   * on every name write), so a bare junction insert would be wiped by the next
   * name edit. The durable write is the name itself: set assigned_to_name to
   * the person's canonical roster name and the trigger mints the junction row
   * buildSubsHqRows counts. A direct junction upsert follows as belt-and-braces
   * for names resolve_pay_person_id can't map (e.g. duplicate roster names).
   */
  async function assignGroup(group: UnattributedGroup, person: { id: string; name: string }) {
    setAssignSavingKey(group.key)
    const upd = await supabase.from('people_labor_jobs').update({ assigned_to_name: person.name }).in('id', group.sheetIds)
    if (upd.error) {
      setAssignSavingKey(null)
      setError(`Failed to assign sheets: ${upd.error.message}`)
      return
    }
    const ins = await supabase
      .from('people_labor_job_assignees')
      .upsert(
        group.sheetIds.map((labor_job_id) => ({ labor_job_id, person_id: person.id })),
        { onConflict: 'labor_job_id,person_id', ignoreDuplicates: true },
      )
    if (ins.error) setError(`Sheets renamed but the roster link failed: ${ins.error.message}`)
    setAssignSavingKey(null)
    setAssignPickerKey(null)
    await load()
  }

  async function updateDoc(docId: string, patch: { doc_type?: string; expires_at?: string | null }) {
    setSavingDocId(docId)
    const { error: err } = await supabase.from('person_contract_documents').update(patch).eq('id', docId)
    setSavingDocId(null)
    if (err) {
      setError(`Failed to update document: ${err.message}`)
      return
    }
    await load()
  }

  if (error) return <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
  if (!result) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
  if (result.rows.length === 0 && unattributedGroups.length === 0)
    return <p style={{ color: 'var(--text-muted)' }}>No subcontractors on the roster yet.</p>

  // Archived-and-settled sheets are history, not problems — they get a quiet
  // summary line instead of amber rows. Archived with money open stays amber.
  const actionableGroups = unattributedGroups.filter((g) => g.reason !== 'archived' || g.totalBalance > 0)
  const archivedSettledGroups = unattributedGroups.filter((g) => g.reason === 'archived' && g.totalBalance <= 0)
  const actionableSheetCount = actionableGroups.reduce((n, g) => n + g.sheetCount, 0)
  const archivedSettledSheetCount = archivedSettledGroups.reduce((n, g) => n + g.sheetCount, 0)
  const archivedNames = [...new Set(archivedSettledGroups.map((g) => g.archivedPersonName).filter(Boolean))] as string[]

  const visibleGroups = showAllUnattributed ? actionableGroups : actionableGroups.slice(0, 3)

  const archivedSummaryLine = archivedSettledSheetCount > 0 && (
    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
      {archivedSettledSheetCount} sheet{archivedSettledSheetCount === 1 ? ' belongs' : 's belong'} to archived{' '}
      {archivedNames.length === 1 ? 'person' : 'people'}
      {archivedNames.length > 0 ? ` (${archivedNames.join(', ')})` : ''} — nothing owed.
    </p>
  )

  return (
    <div>
      {actionableGroups.length > 0 && (
        <div
          style={{
            marginBottom: '1rem',
            border: '1px solid var(--border-amber)',
            background: 'var(--bg-amber-tint)',
            borderRadius: 8,
            padding: '0.7rem 0.9rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-amber-900)' }}>
            ⚠ {actionableSheetCount} sub {actionableSheetCount === 1 ? "sheet isn't" : "sheets aren't"} linked to anyone on the roster
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', margin: '0.15rem 0 0.5rem' }}>
            Their balances are missing from every sub's Owed column until they're fixed.
          </div>
          {visibleGroups.map((g) => {
            const suggestion = suggestionByGroup.get(g.key)
            const saving = assignSavingKey === g.key
            const addressLabel =
              g.jobNumber && g.label.startsWith(g.jobNumber) ? g.label.slice(g.jobNumber.length).replace(/^ · /, '') : g.label
            return (
              <div
                key={g.key}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.4rem 0',
                  borderTop: '1px solid var(--border-amber-soft)',
                  fontSize: '0.8125rem',
                }}
              >
                {g.jobNumber ? (
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'var(--bg-amber-100)',
                      color: 'var(--text-amber-900)',
                      borderRadius: 5,
                      padding: '0.05rem 0.35rem',
                    }}
                  >
                    #{g.jobNumber}
                  </span>
                ) : null}
                <span style={{ fontWeight: 600 }}>{addressLabel}</span>
                {g.sheetCount > 1 && (
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>· {g.sheetCount} sheets</span>
                )}
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Assigned to:{' '}
                  {g.rawAssignedTo ? (
                    <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-strong)' }}>"{g.rawAssignedTo}"</span>
                  ) : (
                    '— (blank)'
                  )}
                </span>
                <span
                  title={g.reason === 'archived' && g.archivedPersonName ? `Matches archived roster person "${g.archivedPersonName}" — shown because money is still open` : undefined}
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 650,
                    borderRadius: 999,
                    padding: '0.08rem 0.5rem',
                    whiteSpace: 'nowrap',
                    background:
                      g.reason === 'shared' ? 'var(--bg-blue-tint)' : g.reason === 'archived' ? 'var(--bg-amber-100)' : 'var(--bg-red-tint)',
                    color:
                      g.reason === 'shared' ? 'var(--text-blue-700)' : g.reason === 'archived' ? 'var(--text-amber-900)' : 'var(--text-red-700)',
                  }}
                >
                  {g.reason === 'shared' ? 'Multiple subs' : g.reason === 'archived' ? 'Archived person' : 'No roster match'}
                </span>
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: g.totalBalance > 0 ? 700 : 400,
                    color: g.totalBalance > 0 ? 'var(--text-strong)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ${Math.round(g.totalBalance).toLocaleString('en-US')} open
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs?tab=sub_sheet_ledger&editLabor=${encodeURIComponent(g.sheetIds[0] ?? '')}`)}
                    style={{ padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}
                  >
                    Open →
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setAssignPickerKey((prev) => (prev === g.key ? null : g.key))}
                    style={{ padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}
                  >
                    Assign…
                  </button>
                  {suggestion && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void assignGroup(g, suggestion)}
                      style={{ padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-900)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 650, fontFamily: 'inherit' }}
                    >
                      ✨ Link to {suggestion.name}
                    </button>
                  )}
                  {saving && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saving…</span>}
                </span>
                {assignPickerKey === g.key && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', paddingLeft: '0.1rem' }}>
                    <select
                      autoFocus
                      defaultValue=""
                      disabled={saving}
                      onChange={(e) => {
                        const person = roster.find((r) => r.id === e.target.value)
                        if (person) void assignGroup(g, person)
                      }}
                      style={{ padding: '0.15rem 0.3rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.78rem' }}
                    >
                      <option value="" disabled>
                        {g.reason === 'shared' ? 'Reassign to one sub…' : 'Link these sheets to…'}
                      </option>
                      {roster.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {g.reason === 'shared' && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Picking one sub replaces the current multi-name assignment.
                      </span>
                    )}
                  </span>
                )}
              </div>
            )
          })}
          {actionableGroups.length > 3 && !showAllUnattributed && (
            <button
              type="button"
              onClick={() => setShowAllUnattributed(true)}
              style={{ marginTop: '0.4rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-link)', fontFamily: 'inherit' }}
            >
              Show all {actionableSheetCount} sheets
            </button>
          )}
        </div>
      )}
      {archivedSummaryLine}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              {['Sub', 'Open work orders', 'Balance due', 'Compliance', 'Track record'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 2 ? 'right' : 'left',
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-faint)',
                    padding: '0.4rem 0.6rem',
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.personId} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                <td style={{ padding: '0.6rem' }}>
                  <div style={{ fontWeight: 650, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {row.name}
                    <SubPortalGlobeButton personId={row.personId} personName={row.name} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {row.hasAccount ? row.email ?? 'account linked' : 'roster only — no login'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedPersonId((prev) => (prev === row.personId ? null : row.personId))}
                    style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-link)', fontFamily: 'inherit' }}
                  >
                    {expandedPersonId === row.personId ? '▼' : '▶'} Documents ({(docsByPerson[row.personId] ?? []).length})
                  </button>
                </td>
                <td style={{ padding: '0.6rem' }}>
                  {row.openCommitments.length === 0 ? (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  ) : (
                    row.openCommitments.map((c, i) => (
                      <div key={i} style={{ whiteSpace: 'nowrap' }}>
                        {c.stepName ?? 'Step'}
                        {c.projectName ? <span style={{ color: 'var(--text-muted)' }}> @ {c.projectName}</span> : null}{' '}
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(c.amount)}</span>{' '}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({c.status})</span>
                      </div>
                    ))
                  )}
                </td>
                <td style={{ padding: '0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: row.balanceDue > 0 ? 700 : 400 }}>
                  {row.balanceDue > 0 ? money(row.balanceDue) : '—'}
                </td>
                <td style={{ padding: '0.6rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {row.badges.map((b) => (
                      <span key={b.key} style={{ ...BADGE_STYLE[b.state], fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {row.sheetCount} sheet{row.sheetCount === 1 ? '' : 's'} · {row.settledCount} settled
                  {row.backchargeTotal > 0 ? <> · {money(row.backchargeTotal)} backcharged</> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expandedPersonId && (
        <div style={{ margin: '0.75rem 0', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem' }}>
            Documents — {result.rows.find((r) => r.personId === expandedPersonId)?.name}
          </h4>
          {(docsByPerson[expandedPersonId] ?? []).length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No documents yet — send one from the Contracts tab, then classify it here.
            </p>
          ) : (
            (docsByPerson[expandedPersonId] ?? []).map((d) => (
              <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', borderBottom: '1px dashed var(--border)', fontSize: '0.8125rem' }}>
                <span style={{ minWidth: '10rem' }}>{d.document_name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({d.status})</span>
                <select
                  value={d.doc_type ?? 'agreement'}
                  disabled={savingDocId === d.id}
                  onChange={(e) => void updateDoc(d.id, { doc_type: e.target.value })}
                  style={{ padding: '0.15rem 0.3rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.78rem' }}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  expires
                  <input
                    type="date"
                    value={d.expires_at ?? ''}
                    disabled={savingDocId === d.id}
                    onChange={(e) => void updateDoc(d.id, { expires_at: e.target.value || null })}
                    style={{ padding: '0.15rem 0.3rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.78rem' }}
                  />
                </label>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  )
}
