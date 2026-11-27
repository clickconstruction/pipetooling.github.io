/**
 * Subs on this job (punch list #346, PR 4): the job's window says who is owed what on the job. The same kernel as
 * the row on People → Subs, turned the other way: the job, then each person, then each sheet (`buildJobOwedBlock`).
 *
 * It reads this job's sheets alone, with their lines, payments and names, under the reader's own policies, and is
 * drawn for the roles who open Jobs → Subs → Pay today. Read only: a sheet opens on the Pay view, a name opens the
 * person's row on People → Subs.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSubsOwed } from '../../hooks/useSubsOwed'
import { buildJobOwedBlock, owedMoney, owedSettledWords, type JobOwedBlock, type OwedSheet } from '../../lib/people/subOwedBreakdown'
import type { SubLaborSheetAssignee } from '../../lib/subLaborOutstanding'
import { sheetOwedToChip, TEAM_SHEET_RULE } from '../../lib/subWorkOrders/teamSheetRule'
import { WE_OWE_NOTHING } from '../../lib/subWorkOrders/subPaymentsLedger'
import type { LaborJob, LaborJobPayment } from '../../types/laborJob'
import { MoneyText } from '../Money'

/** The roles with a policy on sub payments: the ones who open Jobs → Subs → Pay. */
const CAN_SEE = new Set(['dev', 'master_technician', 'assistant', 'controller'])

const door: CSSProperties = { padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-link)', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

function Eq({ label, value, total }: { label: string; value: number; total?: boolean }) {
  return (
    <span style={{ display: 'grid', gap: 1 }}>
      <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>{label}</span>
      <b style={{ ...num, fontSize: total ? '1.02rem' : '0.92rem', color: 'var(--text-strong)' }}><MoneyText text={owedMoney(value)} /></b>
    </span>
  )
}

/** The block itself, over a built model, so a test can draw it without a database. */
export function JobSubsOwedView({ title, block, onOpenSheet, onOpenPerson, onShowSheets }: { title: string; block: JobOwedBlock; onOpenSheet?: (sheetId: string) => void; onOpenPerson?: (personId: string) => void; onShowSheets?: (sheetIds: string[]) => void }) {
  const sheetRow = (s: OwedSheet) => (
    <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem 0.6rem', padding: '0.3rem 0 0.3rem 0.9rem', borderBottom: '1px dashed var(--border)', fontSize: '0.8125rem' }}>
      <b>{s.title}</b>
      {s.withNames.length > 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>with {s.withNames.join(', ')}</span> : null}
      {s.settled ? (
        <span style={{ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-600)' }}><MoneyText text={owedSettledWords(s)} /></span>
      ) : s.payWhen ? (
        <span title={s.payWhen.detail} style={{ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', background: s.payWhen.tone === 'green' ? 'var(--bg-green-tint)' : s.payWhen.tone === 'red' ? 'var(--bg-red-tint)' : s.payWhen.tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-neutral-100)', color: s.payWhen.tone === 'green' ? 'var(--text-green-600)' : s.payWhen.tone === 'red' ? 'var(--text-red-700)' : s.payWhen.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
          {s.payWhen.label}
        </span>
      ) : null}
      {onOpenSheet ? (
        <button type="button" style={door} onClick={() => onOpenSheet(s.id)}>
          Open the sheet ›
        </button>
      ) : null}
      <b style={{ ...num, marginLeft: 'auto' }}><MoneyText text={owedMoney(s.open)} /></b>
    </div>
  )
  return (
    <div data-testid="job-subs-owed" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '0.4rem 0.9rem', margin: '0.5rem 0', padding: '0.5rem 0.7rem', background: 'var(--bg-page)', borderRadius: 6 }}>
        <Eq label="Agreed" value={block.agreed} />
        <i style={{ fontStyle: 'normal', color: 'var(--text-faint)', paddingBottom: 2 }}>−</i>
        <Eq label="Paid" value={block.paid} />
        <i style={{ fontStyle: 'normal', color: 'var(--text-faint)', paddingBottom: 2 }}>−</i>
        <Eq label="Back-charged" value={block.backcharged} />
        <i style={{ fontStyle: 'normal', color: 'var(--text-faint)', paddingBottom: 2 }}>=</i>
        <Eq label="Still open" value={block.open} total />
      </div>
      {block.people.map((p) => (
        <div key={p.key} style={{ marginTop: '0.45rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 0.6rem', fontSize: '0.875rem', fontWeight: 650, borderBottom: '1px solid var(--border)', paddingBottom: 3 }}>
            <span>{p.name}</span>
            {p.kind === 'team' ? <span style={{ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' }}>{sheetOwedToChip('team')}</span> : null}
            {p.personId && onOpenPerson ? (
              <button type="button" style={door} onClick={() => onOpenPerson(p.personId!)}>
                What we owe {p.name.split(' ')[0]} ›
              </button>
            ) : null}
            <span style={{ ...num, marginLeft: 'auto' }}>{p.open > 0 ? <MoneyText text={`${owedMoney(p.open)} open`} /> : WE_OWE_NOTHING}</span>
          </div>
          {p.sheets.map(sheetRow)}
        </div>
      ))}
      {block.shared.length > 0 ? (
        <div style={{ marginTop: '0.45rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 650, borderBottom: '1px solid var(--border)', paddingBottom: 3 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', marginRight: 6 }}>Shared</span>
            On nobody's row until the sheet names one sub
          </div>
          {block.shared.map(sheetRow)}
        </div>
      ) : null}
      {block.payroll.map(({ names, sheet }) => (
        <div key={sheet.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.6rem', marginTop: '0.45rem', fontSize: '0.8125rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' }}>{sheetOwedToChip('payroll')}</span>
          <span>{names}</span>
          <span style={{ color: 'var(--text-muted)' }}>{sheet.title}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{sheet.open > 0 ? <MoneyText text={`${owedMoney(sheet.open)} open, in no figure`} /> : 'nothing open'}</span>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.8rem', marginTop: '0.6rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
        <span>{block.sumWords}</span>
        <span style={{ fontWeight: 650, color: block.addsUp ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{block.addsUp ? '✓ adds up' : 'does not add up'}</span>
      </div>
      {block.sameLines.map((l) => (
        <div key={`${l.label}-${l.amount}`} role="alert" style={{ marginTop: 8, padding: '0.45rem 0.65rem', borderRadius: 8, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-900)', fontSize: '0.8125rem' }}>
          {l.words}{' '}
          {onShowSheets ? (
            <button type="button" style={door} onClick={() => onShowSheets(l.sheetIds)}>
              Show the sheets ›
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** The job's sheets, read lean: only this job's rows. */
function useJobSheets(jobId: string | null, jobNumber: string, enabled: boolean): { sheets: LaborJob[]; assignees: Map<string, SubLaborSheetAssignee[]>; loaded: boolean } {
  const [state, setState] = useState<{ sheets: LaborJob[]; assignees: Map<string, SubLaborSheetAssignee[]>; loaded: boolean }>({ sheets: [], assignees: new Map(), loaded: false })
  useEffect(() => {
    if (!enabled || !jobId) return
    let cancelled = false
    void (async () => {
      const cols = 'id, assigned_to_name, address, job_number, job_ledger_id, labor_rate, job_date, created_at, stage, stage_changed_at, stage_source, payable_after, pay_hold_reason, progress_pct, progress_at'
      const number = jobNumber.trim()
      const [linked, loose] = await Promise.all([
        supabase.from('people_labor_jobs').select(cols).eq('job_ledger_id', jobId),
        // A sheet that never got a link is this job's by its number, as on the Pay view.
        number ? supabase.from('people_labor_jobs').select(cols).is('job_ledger_id', null).eq('job_number', number) : Promise.resolve({ data: [] as unknown[] }),
      ])
      const rows = [...((linked.data ?? []) as unknown as LaborJob[]), ...((loose.data ?? []) as unknown as LaborJob[])]
      const ids = rows.map((r) => r.id)
      if (ids.length === 0) {
        if (!cancelled) setState({ sheets: [], assignees: new Map(), loaded: true })
        return
      }
      const [items, payments, assignees] = await Promise.all([
        supabase.from('people_labor_job_items').select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', ids).order('sequence_order', { ascending: true }),
        supabase.from('people_labor_job_payments').select('id, job_id, amount, memo, created_at, payment_date, method, method_ref').in('job_id', ids).order('sequence_order', { ascending: true }),
        supabase.from('people_labor_job_assignees').select('labor_job_id, person_id, people(name)').in('labor_job_id', ids),
      ])
      if (cancelled) return
      const byId = new Map(rows.map((r) => [r.id, { ...r, items: [] as NonNullable<LaborJob['items']>, payments: [] as LaborJobPayment[] }]))
      for (const it of (items.data ?? []) as Array<{ job_id: string } & NonNullable<LaborJob['items']>[number]>) byId.get(it.job_id)?.items.push(it)
      for (const p of (payments.data ?? []) as unknown as Array<{ job_id: string } & LaborJobPayment>) byId.get(p.job_id)?.payments.push({ ...p, amount: Number(p.amount) })
      const map = new Map<string, SubLaborSheetAssignee[]>()
      for (const a of (assignees.data ?? []) as unknown as Array<{ labor_job_id: string; person_id: string; people: { name: string } | { name: string }[] | null }>) {
        const person = Array.isArray(a.people) ? a.people[0] : a.people
        map.set(a.labor_job_id, [...(map.get(a.labor_job_id) ?? []), { personId: a.person_id, personName: person?.name ?? null }])
      }
      setState({ sheets: [...byId.values()], assignees: map, loaded: true })
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, jobId, jobNumber])
  return state
}

export function JobSubsOwedBlock({ jobId, jobNumber, jobName }: { jobId: string | null; jobNumber: string; jobName: string }) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const canSee = role != null && CAN_SEE.has(role)
  const { sheets, assignees, loaded } = useJobSheets(jobId, jobNumber, canSee)
  const owed = useSubsOwed(sheets, assignees, TEAM_SHEET_RULE, canSee && sheets.length > 0)
  const block = useMemo(() => buildJobOwedBlock(owed.inputs), [owed.inputs])
  // Nothing to say on a job with no sub sheets: the Costs tab already reads "no sub labor".
  if (!canSee || !jobId || !loaded || sheets.length === 0 || !owed.ready) return null
  return (
    <JobSubsOwedView
      title={`${jobNumber.trim() ? `#${jobNumber.trim()} ` : ''}${jobName.trim()} · subs on this job`}
      block={block}
      onOpenSheet={(id) => navigate(`/jobs?tab=subs&view=pay&editLabor=${encodeURIComponent(id)}`)}
      onOpenPerson={(personId) => navigate(`/people?tab=subs&owed=${encodeURIComponent(personId)}`)}
      onShowSheets={() => navigate(`/jobs?tab=subs&view=pay&subSearch=${encodeURIComponent(jobNumber.trim())}`)}
    />
  )
}

export default JobSubsOwedBlock
