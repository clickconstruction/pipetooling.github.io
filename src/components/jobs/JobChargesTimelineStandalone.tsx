/** Self-fetching "Cost breakdown" timeline for one job — used at the bottom of the Parts cost
 * section in the Job Detail and Edit Job modals. Fetches only this job's data (no org-wide
 * scans): materials snapshot (mercury/supply/tally lines), reports, sub-labor rows by HCP #,
 * per-job team labor (`fetchTeamLaborBreakdownForJob`), and mileage settings; payments/
 * revenue/materials come from the passed job row. Streams a role can't read simply don't
 * chart (RLS returns nothing). Renders the shared `JobChargesTimelineChartView`. */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  buildJobChargeEvents,
  buildJobChargesTimelineChartData,
  buildJobPaymentEvents,
  buildJobValueEvents,
  ymdFromDateOnlyOrIso,
  type JobChargesTimelineData,
} from '../../lib/jobChargesTimeline'
import { fetchJobMaterialsCostSnapshot } from '../../lib/fetchJobMaterialsCostSnapshot'
import { fetchTeamLaborBreakdownForJob } from '../../utils/teamLabor'
import { laborJobSubCost } from '../../lib/jobs/subLaborCost'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { JobChargesTimelineChartView } from './JobSummaryChargesTimelineChart'
import type { JobWithDetails } from '../../types/jobWithDetails'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: JobChargesTimelineData; cardChargesExcluded: boolean }

export default function JobChargesTimelineStandalone({ job }: { job: JobWithDetails }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const toYmd = (raw: string | null | undefined) =>
          ymdFromDateOnlyOrIso(raw, calendarYmdInAppTzFromIso)
        const hcp = (job.hcp_number ?? '').trim()

        const [snapshot, teamBreakdown, reportsRes, settingsRes, laborJobsRes] = await Promise.all([
          fetchJobMaterialsCostSnapshot(job.id),
          fetchTeamLaborBreakdownForJob(supabase, job.id).catch(() => []),
          supabase
            .from('reports')
            .select('id, created_at, field_values, users!reports_created_by_user_id_fkey(name)')
            .eq('job_ledger_id', job.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('app_settings')
            .select('key, value_num')
            .in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
          hcp
            ? supabase
                .from('people_labor_jobs')
                .select('id, assigned_to_name, job_date, created_at, labor_rate, distance_miles')
                .eq('job_number', hcp)
            : Promise.resolve({ data: [] as never[] }),
        ])

        let mileageCost = 0.7
        let timePerMile = 0.02
        for (const s of (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>) {
          if (s.key === 'drive_mileage_cost' && s.value_num != null) mileageCost = Number(s.value_num)
          if (s.key === 'drive_time_per_mile' && s.value_num != null) timePerMile = Number(s.value_num)
        }

        type LaborJobRow = {
          id: string
          assigned_to_name: string | null
          job_date: string | null
          created_at: string | null
          labor_rate: number | null
          distance_miles: number | null
        }
        const laborJobs = ((laborJobsRes.data ?? []) as LaborJobRow[]) || []
        let itemsByJobId = new Map<string, Array<Record<string, unknown>>>()
        if (laborJobs.length > 0) {
          const itemsRes = await supabase
            .from('people_labor_job_items')
            .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
            .in(
              'job_id',
              laborJobs.map((j) => j.id),
            )
          itemsByJobId = new Map()
          for (const it of (itemsRes.data ?? []) as Array<Record<string, unknown> & { job_id: string }>) {
            const arr = itemsByJobId.get(it.job_id) ?? []
            arr.push(it)
            itemsByJobId.set(it.job_id, arr)
          }
        }

        const chargeEvents = buildJobChargeEvents({
          teamLaborBreakdown: teamBreakdown.map((b) => ({
            personName: b.personName,
            byWorkDate: b.byWorkDate,
          })),
          subLabor: laborJobs.map((lj) => ({
            dateKey: toYmd(lj.job_date ?? lj.created_at),
            amount: laborJobSubCost(
              {
                labor_rate: lj.labor_rate,
                items: (itemsByJobId.get(lj.id) ?? []) as never,
                distance_miles: lj.distance_miles,
              },
              mileageCost,
              timePerMile,
            ),
            assignedToName: lj.assigned_to_name ?? '',
          })),
          mercury: snapshot.mercuryAllocLines.map((m) => ({
            dateKey: toYmd(m.postedAt),
            amount: Math.abs(Number(m.allocationAmount)),
            counterpartyName: m.counterpartyName,
            attributionDisplayName: null,
          })),
          supplyHouse: snapshot.supplyInvoiceLines.map((l) => ({
            dateKey: toYmd(l.invoiceDate),
            allocatedAmount: l.allocatedAmount,
            supplyHouseName: l.supplyHouseName ?? '',
            invoiceNumber: l.invoiceNumber,
          })),
          tallyParts: snapshot.tallyPartLines.map((t) => ({
            dateKey: toYmd(t.createdAt),
            amount: t.lineTotal,
            fixtureOrPartName: t.partName ?? t.fixtureName,
            createdByName: t.createdByName,
          })),
          billedMaterials: (job.materials ?? []).map((m) => ({
            dateKey: toYmd(m.created_at),
            amount: Number(m.amount ?? 0),
            description: m.description,
          })),
        })
        type ReportRow = {
          created_at: string
          field_values: Record<string, unknown> | null
          users: { name: string | null } | null
        }
        const valueEvents = buildJobValueEvents(
          (((reportsRes.data ?? []) as unknown) as ReportRow[]).map((r) => ({
            dateKey: toYmd(r.created_at),
            createdByName: r.users?.name ?? null,
            fieldValues: r.field_values,
          })),
        )
        const paymentEvents = buildJobPaymentEvents(
          (job.payments ?? []).map((p) => ({
            dateKey: toYmd(p.paid_on ?? p.created_at),
            amount: Number(p.amount ?? 0),
            paymentType: p.payment_type,
            note: p.note,
          })),
        )
        const revenue = job.revenue != null ? Number(job.revenue) : null
        const data = buildJobChargesTimelineChartData(chargeEvents, valueEvents, revenue, paymentEvents)
        if (!cancelled) {
          setState({ kind: 'ready', data, cardChargesExcluded: snapshot.mercuryFetchFailed })
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.35rem' }}>
        Cost breakdown
      </div>
      {state.kind === 'loading' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Loading charge timeline…</p>
      ) : state.kind === 'error' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
          Could not load the charge timeline.
        </p>
      ) : state.data.chartRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
          No dated cost events or reports yet.
        </p>
      ) : (
        <JobChargesTimelineChartView
          data={state.data}
          revenue={job.revenue != null ? Number(job.revenue) : null}
          cardChargesExcluded={state.cardChargesExcluded}
        />
      )}
    </div>
  )
}
