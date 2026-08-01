import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { buildSubsHqRows, type SubsHqResult } from '../../lib/people/subsHqRows'
import type { ComplianceBadge } from '../../lib/people/subCompliance'

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
  const [result, setResult] = useState<SubsHqResult | null>(null)
  const [docsByPerson, setDocsByPerson] = useState<Record<string, DocRow[]>>({})
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingDocId, setSavingDocId] = useState<string | null>(null)

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
  if (result.rows.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No subcontractors on the roster yet.</p>

  return (
    <div>
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
                  <div style={{ fontWeight: 650 }}>{row.name}</div>
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

      {result.unattributed.length > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-strong)' }}>Unattributed sheets ({result.unattributed.length}):</strong>{' '}
          {result.unattributed.map((u) => `${u.label} (${u.reason === 'shared' ? 'multiple subs' : 'no roster match'}${u.balance > 0 ? ` · ${money(u.balance)} open` : ''})`).join(' · ')}
          <span> — fix names or assignments in Jobs → Sub Labor.</span>
        </div>
      )}
    </div>
  )
}
