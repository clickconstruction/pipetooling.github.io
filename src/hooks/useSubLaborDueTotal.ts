import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Fetches and computes Sub Labor Due total (for use outside React, e.g. Settings). */
export async function fetchSubLaborDueTotal(): Promise<number> {
  const { data: jobs, error: jobsErr } = await supabase
    .from('people_labor_jobs')
    .select('id, assigned_to_name, address, job_number, labor_rate, distance_miles')
    .order('created_at', { ascending: false })

  if (jobsErr || !jobs?.length) return 0

  const jobIds = (jobs as LaborJobRow[]).map((j) => j.id)
  const [itemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('people_labor_job_items')
      .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate')
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

  let sum = 0
  for (const job of jobs as LaborJobRow[]) {
    const jobRate = job.labor_rate ?? 0
    const jobItems = itemsByJob.get(job.id) ?? []
    const laborTotal = jobItems.reduce((s, i) => {
      const hrs = Number(i.hrs_per_unit) || 0
      const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
      const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
      return s + laborHrs * rate
    }, 0)
    let totalCost = laborTotal
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
    if (balance > 0) sum += balance
  }
  return sum
}

type LaborJobRow = {
  id: string
  assigned_to_name: string | null
  address: string | null
  job_number: string | null
  labor_rate: number | null
  distance_miles: number | null
}

type LaborItemRow = {
  job_id: string
  fixture: string
  count: number
  hrs_per_unit: number
  is_fixed?: boolean
  labor_rate?: number | null
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
        const { data: jobs, error: jobsErr } = await supabase
          .from('people_labor_jobs')
          .select('id, assigned_to_name, address, job_number, labor_rate, distance_miles')
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (jobsErr || !jobs?.length) {
          setTotal(jobsErr ? null : 0)
          return
        }

        const jobIds = (jobs as LaborJobRow[]).map((j) => j.id)
        const [itemsRes, paymentsRes] = await Promise.all([
          supabase
            .from('people_labor_job_items')
            .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate')
            .in('job_id', jobIds)
            .order('sequence_order', { ascending: true }),
          supabase
            .from('people_labor_job_payments')
            .select('job_id, amount')
            .in('job_id', jobIds)
            .order('sequence_order', { ascending: true }),
        ])

        if (cancelled) return

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

        let sum = 0
        for (const job of jobs as LaborJobRow[]) {
          const jobRate = job.labor_rate ?? 0
          const jobItems = itemsByJob.get(job.id) ?? []
          const laborTotal = jobItems.reduce((s, i) => {
            const hrs = Number(i.hrs_per_unit) || 0
            const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
            const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
            return s + laborHrs * rate
          }, 0)
          let totalCost = laborTotal
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
          if (balance > 0) sum += balance
        }

        if (!cancelled) setTotal(sum)
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
