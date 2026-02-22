import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Database } from '../../types/database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']

type JobWithDetails = JobsLedgerRow & {
  materials: JobsLedgerMaterial[]
  fixtures: JobsLedgerFixture[]
}

export function JobsBillingReminderSection() {
  const { user: authUser, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<{
    specificWork: number
    billedMaterials: number
    totalBill: number
  } | null>(null)

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data: jobsData, error: jobsErr } = await supabase
        .from('jobs_ledger')
        .select('*')
        .order('hcp_number', { ascending: false })
      if (jobsErr || cancelled) {
        setLoading(false)
        return
      }
      const jobList = (jobsData ?? []) as JobsLedgerRow[]
      if (jobList.length === 0 || cancelled) {
        setCounts({ specificWork: 0, billedMaterials: 0, totalBill: 0 })
        setLoading(false)
        return
      }
      const jobIds = jobList.map((j) => j.id)
      const [matsRes, fixturesRes] = await Promise.all([
        supabase.from('jobs_ledger_materials').select('*').in('job_id', jobIds).order('sequence_order'),
        supabase.from('jobs_ledger_fixtures').select('*').in('job_id', jobIds).order('sequence_order'),
      ])
      const materialsList = (matsRes.data ?? []) as JobsLedgerMaterial[]
      const fixturesList = (fixturesRes.data ?? []) as JobsLedgerFixture[]
      const materialsByJob = new Map<string, JobsLedgerMaterial[]>()
      for (const m of materialsList) {
        const arr = materialsByJob.get(m.job_id) ?? []
        arr.push(m)
        materialsByJob.set(m.job_id, arr)
      }
      const fixturesByJob = new Map<string, JobsLedgerFixture[]>()
      for (const f of fixturesList) {
        const arr = fixturesByJob.get(f.job_id) ?? []
        arr.push(f)
        fixturesByJob.set(f.job_id, arr)
      }
      const jobsWithDetails: JobWithDetails[] = jobList.map((j) => ({
        ...j,
        materials: materialsByJob.get(j.id) ?? [],
        fixtures: fixturesByJob.get(j.id) ?? [],
      }))

      let specificWork = 0
      let billedMaterials = 0
      let totalBill = 0
      for (const job of jobsWithDetails) {
        const hasSpecificWork =
          job.fixtures.length > 0 && job.fixtures.some((f) => (f.name ?? '').trim() && Number(f.count) > 0)
        if (!hasSpecificWork) specificWork++
        const hasBilledMaterials =
          job.materials.length > 0 && job.materials.some((m) => Number(m.amount) !== 0)
        if (!hasBilledMaterials) billedMaterials++
        const rev = job.revenue
        if (rev == null || Number(rev) === 0) totalBill++
      }
      if (!cancelled) {
        setCounts({ specificWork, billedMaterials, totalBill })
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const canAccess = role === 'dev' || role === 'master_technician' || role === 'assistant'
  if (!canAccess) return null

  if (loading) return null

  const total = counts ? counts.specificWork + counts.billedMaterials + counts.totalBill : 0
  if (total === 0) return null

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem 1.25rem',
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: 8,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#92400e' }}>
        Keep Jobs Billing up to date: {counts?.specificWork ?? 0} Specific Work, {counts?.billedMaterials ?? 0} Billed
        Materials, {counts?.totalBill ?? 0} Total Bill need filling
      </span>
      <Link
        to="/jobs?tab=ledger"
        style={{
          padding: '0.35rem 0.75rem',
          background: '#f59e0b',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}
      >
        Fill in Jobs Billing
      </Link>
    </div>
  )
}
