import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type TallyPartRow = {
  job_id: string
  price_at_time: number | null
  quantity: number
}

type LaborJob = {
  id: string
  job_number: string | null
  labor_rate: number | null
  distance_miles?: number | null
  items?: Array<{ count: number; hrs_per_unit: number; is_fixed?: boolean }>
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  revenue: number | null
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export default function JobBillDetailsModal({ open, onClose, jobId, hcpNumber, jobName, jobAddress, revenue }: Props) {
  const [loading, setLoading] = useState(false)
  const [laborCost, setLaborCost] = useState<number>(0)
  const [partsCost, setPartsCost] = useState<number>(0)

  useEffect(() => {
    if (!open || !jobId) return
    setLoading(true)
    const hcp = (hcpNumber ?? '').trim().toLowerCase()
    const totalBill = revenue != null ? Number(revenue) : 0

    Promise.all([
      supabase.rpc('list_tally_parts_with_po'),
      supabase
        .from('people_labor_jobs')
        .select('id, job_number, labor_rate, distance_miles')
        .order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
    ])
      .then(([tallyRes, laborRes, settingsRes]) => {
        const tallyData = (tallyRes.data ?? []) as TallyPartRow[]
        const laborJobsData = (laborRes.data ?? []) as LaborJob[]
        const settingsRows = settingsRes.data ?? []
        const byKey = new Map(settingsRows.map((r: { key: string; value_num: number | null }) => [r.key, r.value_num]))
        const mileageCost = byKey.get('drive_mileage_cost') ?? 0.70
        const timePerMile = byKey.get('drive_time_per_mile') ?? 0.02

        let parts = 0
        for (const r of tallyData) {
          if (r.job_id === jobId) {
            parts += Number(r.price_at_time ?? 0) * Number(r.quantity)
          }
        }
        setPartsCost(parts)

        let labor = 0
        if (hcp) {
          const jobIds = laborJobsData.filter((j) => (j.job_number ?? '').trim().toLowerCase() === hcp).map((j) => j.id)
          if (jobIds.length) {
            return supabase
              .from('people_labor_job_items')
              .select('job_id, count, hrs_per_unit, is_fixed')
              .in('job_id', jobIds)
              .order('sequence_order', { ascending: true })
              .then(({ data: items }) => {
                const itemsByJob = new Map<string, Array<{ count: number; hrs_per_unit: number; is_fixed?: boolean }>>()
                for (const it of (items ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed?: boolean }>) {
                  if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
                  itemsByJob.get(it.job_id)!.push({ count: it.count, hrs_per_unit: it.hrs_per_unit, is_fixed: it.is_fixed })
                }
                for (const job of laborJobsData) {
                  if ((job.job_number ?? '').trim().toLowerCase() !== hcp) continue
                  const totalHrs = (itemsByJob.get(job.id) ?? []).reduce((s, i) => {
                    const hrs = Number(i.hrs_per_unit) || 0
                    return s + ((i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs)
                  }, 0)
                  const rate = job.labor_rate ?? 0
                  const miles = Number(job.distance_miles) || 0
                  const driveCost =
                    miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
                  labor += totalHrs * rate + driveCost
                }
                setLaborCost(labor)
              })
          }
        }
        setLaborCost(0)
      })
      .catch(() => {
        setLaborCost(0)
        setPartsCost(0)
      })
      .finally(() => setLoading(false))
  }, [open, jobId, hcpNumber, revenue])

  if (!open) return null

  const totalBill = revenue != null ? Number(revenue) : 0
  const profit = totalBill - partsCost - laborCost

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Job Bill Details</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </header>
        <div style={{ padding: '1.5rem' }}>
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }}>HCP #</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }}>Address</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }}>Labor Cost</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }}>Parts Cost</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }}>Total Bill</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>{hcpNumber || '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>{jobName || '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>{jobAddress || '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {formatCurrency(laborCost)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {formatCurrency(partsCost)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {formatCurrency(totalBill)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {formatCurrency(profit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
