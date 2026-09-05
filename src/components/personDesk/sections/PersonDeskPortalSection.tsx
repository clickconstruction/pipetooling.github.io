import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import SubPortalGlobeButton from '../../people/SubPortalGlobeButton'
import { useSubPortalLinkOff } from '../../../hooks/useSubPortalOffStates'
import { buildSubComplianceBadges, type ComplianceBadge } from '../../../lib/people/subCompliance'
import { denverCalendarDayKey } from '../../../utils/dateUtils'
import { Chip, DeskEmpty, DeskRow, DeskSection } from '../personDeskShared'

const TONE: Record<ComplianceBadge['state'], 'green' | 'amber' | 'red' | 'gray'> = { ok: 'green', expiring: 'amber', expired: 'red', missing: 'gray' }

export function PersonDeskPortalSection({ personId, displayName, changeKey }: { personId: string | null; displayName: string; changeKey: number }) {
  const [badges, setBadges] = useState<ComplianceBadge[] | null>(null)
  const [workOrders, setWorkOrders] = useState<{ offered: number; accepted: number } | null>(null)
  const [sheets, setSheets] = useState<number | null>(null)
  const off = useSubPortalLinkOff(personId ?? '')

  useEffect(() => {
    if (!personId) return
    let cancelled = false
    void (async () => {
      const [{ data: docs }, { data: commitments }, { count }] = await Promise.all([
        supabase.from('person_contract_documents').select('doc_type, status, expires_at').eq('person_id', personId),
        supabase.from('step_commitments').select('status').eq('person_id', personId).in('status', ['offered', 'accepted']),
        supabase.from('people_labor_job_assignees').select('labor_job_id', { count: 'exact', head: true }).eq('person_id', personId),
      ])
      if (cancelled) return
      setBadges(buildSubComplianceBadges((docs ?? []) as Array<{ doc_type: string; status: string; expires_at: string | null }>, denverCalendarDayKey(Date.now())))
      const list = (commitments ?? []) as Array<{ status: string }>
      setWorkOrders({ offered: list.filter((c) => c.status === 'offered').length, accepted: list.filter((c) => c.status === 'accepted').length })
      setSheets(count ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [personId, changeKey])

  if (!personId) {
    return (
      <DeskSection id="portal" title="Portal & paperwork">
        <DeskEmpty>The portal, compliance documents and work orders hang off the roster row. Create it from the header first.</DeskEmpty>
      </DeskSection>
    )
  }

  return (
    <DeskSection id="portal" title="Portal & paperwork">
      <DeskRow label="Portal" actions={<SubPortalGlobeButton personId={personId} personName={displayName} size={16} />}>
        {off ? <Chip tone="red">Off</Chip> : <Chip tone="blue">On</Chip>}
        <span style={{ color: 'var(--text-muted)' }}>{off ? 'Nobody can open their page — the globe turns it back on' : 'Copy the link or manage it from the globe'}</span>
      </DeskRow>
      <DeskRow
        label="Compliance"
        actions={
          <a href="/people?tab=contracts" style={{ fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Contracts ›
          </a>
        }
      >
        {badges == null ? <span style={{ color: 'var(--text-muted)' }}>Loading…</span> : badges.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>No documents on file</span> : badges.map((b) => (
          <Chip key={b.key} tone={TONE[b.state]}>
            {b.label}
          </Chip>
        ))}
      </DeskRow>
      <DeskRow label="Work orders">
        {workOrders == null ? (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ) : workOrders.offered + workOrders.accepted === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>None open</span>
        ) : (
          <span>
            {workOrders.offered} offered · {workOrders.accepted} accepted, not settled
          </span>
        )}
      </DeskRow>
      <DeskRow
        label="Sheets"
        actions={
          <a href="/jobs?tab=sub_sheet_ledger" style={{ fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Sub Labor ›
          </a>
        }
      >
        {sheets == null ? '—' : `${sheets} sheet${sheets === 1 ? '' : 's'} linked`}
      </DeskRow>
    </DeskSection>
  )
}
