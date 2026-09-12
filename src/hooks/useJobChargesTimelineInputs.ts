import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  buildJobChargeEvents,
  buildJobManualPercentEvents,
  buildJobPaymentEvents,
  buildJobValueEvents,
  ymdFromDateOnlyOrIso,
  type JobChargeEvent,
  type JobPaymentEvent,
  type JobValueEvent,
} from '../lib/jobChargesTimeline'
import { fetchJobMaterialsCostSnapshot } from '../lib/fetchJobMaterialsCostSnapshot'
import { resolveJobCurrentPercentFallback } from '../lib/jobSummaryPercentComplete'
import { fetchTeamLaborBreakdownForJob } from '../utils/teamLabor'
import { laborJobSubCost } from '../lib/jobs/subLaborCost'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import type { JobWithDetails } from '../types/jobWithDetails'

export type JobChargesTimelineInputs = {
  chargeEvents: JobChargeEvent[]
  valueEvents: JobValueEvent[]
  paymentEvents: JobPaymentEvent[]
  revenue: number | null
  /** Job-level % when no dated report carries one. */
  fallbackPercent: number | null
  /** Recorded team-labor hours on the job (v2.3298) — the Budget card's labor row reads hours before dollars. 0 when team labor is excluded. */
  teamHours: number
  /** Mercury fetch failed (no Banking access) — the chart says so in its key. */
  cardChargesExcluded: boolean
}

export type JobChargesTimelineInputsState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; inputs: JobChargesTimelineInputs }

/**
 * One job's cost events, reports and payments — the inputs the Cost Timeline
 * charts and, since v2.3189, the Burn section reads. Extracted from
 * `JobChargesTimelineStandalone` so the Costs tab fetches once for both.
 * Only this job's data (no org-wide scans): materials snapshot, reports,
 * sub-labor sheets by job link, per-job team labor (gated — when
 * `includeTeamLabor` is false the wage-derived fetch never runs), mileage
 * settings; payments / revenue / materials come from the job row.
 */
export function useJobChargesTimelineInputs(job: JobWithDetails, includeTeamLabor: boolean, enabled = true): JobChargesTimelineInputsState {
  const [state, setState] = useState<JobChargesTimelineInputsState>({ kind: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const toYmd = (raw: string | null | undefined) => ymdFromDateOnlyOrIso(raw, calendarYmdInAppTzFromIso)

        const [snapshot, teamBreakdown, reportsRes, settingsRes, laborJobsRes, pctEventsRes] = await Promise.all([
          fetchJobMaterialsCostSnapshot(job.id),
          includeTeamLabor ? fetchTeamLaborBreakdownForJob(supabase, job.id).catch(() => []) : Promise.resolve([]),
          supabase
            .from('reports')
            .select('id, created_at, field_values, users!reports_created_by_user_id_fkey(name)')
            .eq('job_ledger_id', job.id)
            .order('created_at', { ascending: true }),
          supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
          // v2.3060: the sheet's job link, not its number text.
          supabase
            .from('people_labor_jobs')
            .select('id, assigned_to_name, job_date, created_at, labor_rate, distance_miles')
            .eq('job_ledger_id', job.id),
          // v2.3372: the office's hand-set percents, so a % typed after the last report is the
          // current one (the trigger on jobs_ledger.pct_complete is the single writer; 'seed'
          // rows are the 2026-08-07 back-fill and 'service' rows are report-derived — neither is a hand-set).
          supabase
            .from('job_pct_events')
            .select('pct, changed_at, users!job_pct_events_changed_by_user_id_fkey(name)')
            .eq('job_id', job.id)
            .eq('source', 'manual')
            .order('changed_at', { ascending: true }),
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
          teamLaborBreakdown: teamBreakdown.map((b) => ({ personName: b.personName, byWorkDate: b.byWorkDate })),
          subLabor: laborJobs.map((lj) => ({
            dateKey: toYmd(lj.job_date ?? lj.created_at),
            amount: laborJobSubCost(
              { labor_rate: lj.labor_rate, items: (itemsByJobId.get(lj.id) ?? []) as never, distance_miles: lj.distance_miles },
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
        type ReportRow = { created_at: string; field_values: Record<string, unknown> | null; users: { name: string | null } | null }
        type PctEventRow = { pct: number | null; changed_at: string; users: { name: string | null } | null }
        const valueEvents = [
          ...buildJobValueEvents(
            ((reportsRes.data ?? []) as unknown as ReportRow[]).map((r) => ({
              dateKey: toYmd(r.created_at),
              createdByName: r.users?.name ?? null,
              fieldValues: r.field_values,
            })),
          ),
          ...buildJobManualPercentEvents(
            ((pctEventsRes.data ?? []) as unknown as PctEventRow[]).map((e) => ({
              dateKey: toYmd(e.changed_at),
              pct: e.pct,
              changedByName: e.users?.name ?? null,
            })),
          ),
        ]
        const paymentEvents = buildJobPaymentEvents(
          (job.payments ?? []).map((p) => ({
            dateKey: toYmd(p.paid_on ?? p.created_at),
            amount: Number(p.amount ?? 0),
            paymentType: p.payment_type,
            note: p.note,
          })),
        )
        if (!cancelled) {
          setState({
            kind: 'ready',
            inputs: {
              chargeEvents,
              valueEvents,
              paymentEvents,
              revenue: job.revenue != null ? Number(job.revenue) : null,
              fallbackPercent: resolveJobCurrentPercentFallback(job),
              teamHours: teamBreakdown.reduce((s, b) => s + b.byWorkDate.reduce((t, d) => t + (Number(d.hours) || 0), 0), 0),
              cardChargesExcluded: snapshot.mercuryFetchFailed,
            },
          })
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job.id, includeTeamLabor, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
