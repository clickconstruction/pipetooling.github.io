import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { parseSubWorkOrderSnapshot } from '../../../lib/subWorkOrders/subWorkOrder'
import { Chip, DeskEmpty, DeskRow, DeskSection } from '../personDeskShared'

/**
 * Person Desk · Work orders (Sub Work Orders train, PR 5 — v2.2790): every
 * offer and signed agreement for this person in one list, whichever surface
 * sent it — a Sub Labor sheet (v2.2786) or a project step — with the door to
 * where it lives. Same query the sub portal runs, seen from the office side.
 */

type Row = {
  id: string
  status: string
  amount: number | null
  step_id: string | null
  labor_job_id: string | null
  job_id: string | null
  record_id: string | null
  offered_at: string | null
  signed_at: string | null
  accepted_at: string | null
  settled_at: string | null
  declined_at: string | null
  decline_reason: string | null
  signer_printed_name: string | null
  offer_scope_snapshot: unknown
}

type Item = Row & { label: string; anchor: 'sheet' | 'step' | 'job'; href: string | null; projectName: string | null }

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')

function statusChip(r: Row) {
  if (r.status === 'settled') return <Chip tone="green">Settled {fmt(r.settled_at)}</Chip>
  if (r.status === 'accepted' || r.status === 'approved') return <Chip tone="green">{r.signed_at ? `Signed ${fmt(r.signed_at)}` : `Accepted ${fmt(r.accepted_at)}`}</Chip>
  if (r.status === 'offered') return <Chip tone="amber">Sent{r.offered_at ? ` ${fmt(r.offered_at)}` : ''} · awaiting signature</Chip>
  if (r.status === 'declined') return <Chip tone="red">Declined {fmt(r.declined_at)}</Chip>
  if (r.status === 'draft') return <Chip tone="gray">{r.amount == null ? 'Drafted · no price yet' : 'Drafted'}</Chip>
  return <Chip tone="gray">{r.status}</Chip>
}

export function PersonDeskWorkOrdersSection({ personId, changeKey }: { personId: string | null; changeKey: number }) {
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    if (!personId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('step_commitments')
        .select('id, status, amount, step_id, labor_job_id, job_id, record_id, offered_at, signed_at, accepted_at, settled_at, declined_at, decline_reason, signer_printed_name, offer_scope_snapshot')
        .eq('person_id', personId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50)
      const rows = (data ?? []) as Row[]
      const stepIds = [...new Set(rows.map((r) => r.step_id).filter((id): id is string => !!id))]
      const sheetIds = [...new Set(rows.filter((r) => !r.step_id).map((r) => r.labor_job_id).filter((id): id is string => !!id))]
      const stepInfo = new Map<string, { name: string; projectId: string | null; projectName: string | null }>()
      const sheetInfo = new Map<string, { jobNumber: string | null; address: string | null }>()
      if (stepIds.length > 0) {
        const { data: steps } = await supabase.from('project_workflow_steps').select('id, name, project_workflows(project_id, projects(name))').in('id', stepIds)
        for (const s of (steps ?? []) as Array<{ id: string; name: string; project_workflows: { project_id: string | null; projects: { name: string } | { name: string }[] | null } | { project_id: string | null; projects: { name: string } | { name: string }[] | null }[] | null }>) {
          const wf = Array.isArray(s.project_workflows) ? s.project_workflows[0] : s.project_workflows
          const proj = wf ? (Array.isArray(wf.projects) ? wf.projects[0] : wf.projects) : null
          stepInfo.set(s.id, { name: s.name, projectId: wf?.project_id ?? null, projectName: proj?.name ?? null })
        }
      }
      if (sheetIds.length > 0) {
        const { data: sheets } = await supabase.from('people_labor_jobs').select('id, job_number, address').in('id', sheetIds)
        for (const sh of (sheets ?? []) as Array<{ id: string; job_number: string | null; address: string | null }>) {
          sheetInfo.set(sh.id, { jobNumber: sh.job_number, address: sh.address })
        }
      }
      if (cancelled) return
      setItems(
        rows.map((r) => {
          if (r.step_id) {
            const st = stepInfo.get(r.step_id)
            return {
              ...r,
              anchor: 'step',
              label: st?.name ?? 'Step',
              projectName: st?.projectName ?? null,
              href: st?.projectId ? `/workflows/${st.projectId}#step-${r.step_id}` : null,
            }
          }
          const sh = r.labor_job_id ? sheetInfo.get(r.labor_job_id) : undefined
          const snap = parseSubWorkOrderSnapshot(r.offer_scope_snapshot)
          const label = snap.facts.jobLabel ?? snap.sheetLabel ?? [sh?.jobNumber, sh?.address].filter(Boolean).join(' · ') ?? 'Sub sheet'
          // Work Orders tab PR 3: every non-step order opens on the board (the sheet is one click further).
          return {
            ...r,
            anchor: r.job_id && !r.labor_job_id ? 'job' : 'sheet',
            label: (r.record_id ? `${r.record_id} · ` : '') + (label || 'Sub sheet'),
            projectName: null,
            href: `/jobs?tab=work_orders&wo=${r.id}`,
          }
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [personId, changeKey])

  if (!personId) {
    return (
      <DeskSection id="work_orders" title="Work orders">
        <DeskEmpty>Work orders hang off the roster row. Create it from the header first.</DeskEmpty>
      </DeskSection>
    )
  }

  const open = (items ?? []).filter((i) => i.status === 'offered' || i.status === 'accepted' || i.status === 'approved').length
  return (
    <DeskSection id="work_orders" title="Work orders" who={items ? `${open} open · ${items.length} total` : undefined}>
      {items == null ? (
        <DeskEmpty>Loading…</DeskEmpty>
      ) : items.length === 0 ? (
        <DeskEmpty>No work orders yet — assemble one on Jobs → Work Orders, from the job window, or from a project step.</DeskEmpty>
      ) : (
        items.map((i) => (
          <DeskRow
            key={i.id}
            label={<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{i.amount == null ? 'unpriced' : money(Number(i.amount))}</span>}
            actions={
              i.href ? (
                <a href={i.href} style={{ fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  {i.anchor === 'step' ? 'Step ›' : 'Work order ›'}
                </a>
              ) : null
            }
          >
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {i.label}
              {i.projectName ? <span style={{ color: 'var(--text-muted)' }}> @ {i.projectName}</span> : null}
              <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}> · {i.anchor === 'sheet' ? 'Sub Labor sheet' : i.anchor === 'job' ? 'Job' : 'Project step'}</span>
            </span>
            {statusChip(i)}
            {i.status === 'declined' && i.decline_reason ? <span style={{ color: 'var(--text-muted)' }}>“{i.decline_reason}”</span> : null}
          </DeskRow>
        ))
      )}
    </DeskSection>
  )
}
