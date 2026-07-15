import { useEffect, useState } from 'react'
import { laborItemsSubtotal } from '../lib/peopleLaborJobItemLineCost'
import { supabase } from '../lib/supabase'

/** One sub-labor job with an outstanding balance (labor total − payments − backcharges > 0). */
export type SubLaborDueJobRow = {
  id: string
  assignedToName: string | null
  address: string | null
  jobNumber: string | null
  /** created_at date part (YYYY-MM-DD) — sub jobs have no due date, so age anchors here. */
  createdYmd: string | null
  balance: number
}

/**
 * Per-job outstanding sub-labor balances (Jobs → Sub Labor semantics: labor items × rate,
 * minus payments and backcharges; zero-cost jobs with payments treat paid as the cost).
 * Single source of truth for the Sub Labor Due pin total and the Dashboard AP card.
 */
export async function fetchSubLaborDueJobRows(): Promise<SubLaborDueJobRow[]> {
  const { data: jobs, error: jobsErr } = await supabase
    .from('people_labor_jobs')
    .select('id, assigned_to_name, address, job_number, labor_rate, distance_miles, created_at')
    .order('created_at', { ascending: false })

  if (jobsErr) throw new Error(jobsErr.message)
  if (!jobs?.length) return []

  const jobIds = (jobs as LaborJobRow[]).map((j) => j.id)
  const [itemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('people_labor_job_items')
      .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
      .in('job_id', jobIds)
      .order('sequence_order', { ascending: true }),
    supabase
      .from('people_labor_job_payments')
      .select('job_id, amount')
      .in('job_id', jobIds)
      .order('sequence_order', { ascending: true }),
  ])

  const items = (itemsRes.data ?? []) as LaborItemRow[]
  const payments = (paymentsRes.data ?? []) as LaborPaymentRow[]

  const itemsByJob = new Map<string, LaborItemRow[]>()
  for (const it of items) {
    if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
    itemsByJob.get(it.job_id)!.push(it)
  }
  const paymentsByJob = new Map<string, LaborPaymentRow[]>()
  for (const p of payments) {
    if (!paymentsByJob.has(p.job_id)) paymentsByJob.set(p.job_id, [])
    paymentsByJob.get(p.job_id)!.push(p)
  }

  const rows: SubLaborDueJobRow[] = []
  for (const job of jobs as LaborJobRow[]) {
    const jobRate = job.labor_rate ?? 0
    const jobItems = itemsByJob.get(job.id) ?? []
    let totalCost = laborItemsSubtotal(jobItems, jobRate)
    const jobPayments = paymentsByJob.get(job.id) ?? []
    const paid = jobPayments
      .filter((p) => Number(p.amount) >= 0)
      .reduce((s, p) => s + Number(p.amount), 0)
    const backcharges = jobPayments
      .filter((p) => Number(p.amount) < 0)
      .reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
    if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
      totalCost = paid + backcharges
    }
    const balance = totalCost - paid - backcharges
    if (balance > 0) {
      rows.push({
        id: job.id,
        assignedToName: job.assigned_to_name,
        address: job.address,
        jobNumber: job.job_number,
        createdYmd: job.created_at ? job.created_at.slice(0, 10) : null,
        balance,
      })
    }
  }
  return rows
}

/** Fetches and computes Sub Labor Due total (for use outside React, e.g. Settings). */
export async function fetchSubLaborDueTotal(): Promise<number> {
  try {
    const rows = await fetchSubLaborDueJobRows()
    return rows.reduce((s, r) => s + r.balance, 0)
  } catch {
    return 0
  }
}

type LaborJobRow = {
  id: string
  assigned_to_name: string | null
  address: string | null
  job_number: string | null
  labor_rate: number | null
  distance_miles: number | null
  created_at: string | null
}

type LaborItemRow = {
  job_id: string
  fixture: string
  count: number
  hrs_per_unit: number
  is_fixed?: boolean
  labor_rate?: number | null
  direct_labor_amount?: number | null
}

type LaborPaymentRow = {
  job_id: string
  amount: number
}

export function useSubLaborDueTotal(
  enabled: boolean,
  refreshKey?: number
): { total: number | null; loading: boolean } {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setTotal(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setTotal(null)

    void (async () => {
      try {
        const rows = await fetchSubLaborDueJobRows()
        if (!cancelled) setTotal(rows.reduce((s, r) => s + r.balance, 0))
      } catch {
        if (!cancelled) setTotal(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  return { total, loading }
}
