import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

type JobWithDetails = JobsLedgerRow & {
  materials: JobsLedgerMaterial[]
  team_members: (JobsLedgerTeamMember & { users: { name: string } | null })[]
}

type JobsTab = 'ledger' | 'upcoming' | 'teams-summary'

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
})

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type MaterialRow = { id: string; description: string; amount: number }

export default function Jobs() {
  const { user: authUser } = useAuth()
  const [activeTab, setActiveTab] = useState<JobsTab>('ledger')
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [hcpNumber, setHcpNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [revenue, setRevenue] = useState('')
  const [materials, setMaterials] = useState<MaterialRow[]>([{ id: crypto.randomUUID(), description: '', amount: 0 }])
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadJobs() {
    if (!authUser?.id) return
    setLoading(true)
    setError(null)
    const { data: jobsData, error: jobsErr } = await supabase
      .from('jobs_ledger')
      .select('*')
      .order('created_at', { ascending: false })
    if (jobsErr) {
      setError(jobsErr.message)
      setLoading(false)
      return
    }
    const jobList = (jobsData ?? []) as JobsLedgerRow[]
    if (jobList.length === 0) {
      setJobs([])
      setLoading(false)
      return
    }
    const jobIds = jobList.map((j) => j.id)
    const [matsRes, teamRes] = await Promise.all([
      supabase.from('jobs_ledger_materials').select('*').in('job_id', jobIds).order('sequence_order'),
      supabase
        .from('jobs_ledger_team_members')
        .select('*, users(name)')
        .in('job_id', jobIds),
    ])
    const materialsList = (matsRes.data ?? []) as JobsLedgerMaterial[]
    const teamList = (teamRes.data ?? []) as (JobsLedgerTeamMember & { users: { name: string } | null })[]
    const materialsByJob = new Map<string, JobsLedgerMaterial[]>()
    for (const m of materialsList) {
      const arr = materialsByJob.get(m.job_id) ?? []
      arr.push(m)
      materialsByJob.set(m.job_id, arr)
    }
    const teamByJob = new Map<string, (JobsLedgerTeamMember & { users: { name: string } | null })[]>()
    for (const t of teamList) {
      const arr = teamByJob.get(t.job_id) ?? []
      arr.push(t)
      teamByJob.set(t.job_id, arr)
    }
    const jobsWithDetails: JobWithDetails[] = jobList.map((j) => ({
      ...j,
      materials: (materialsByJob.get(j.id) ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      team_members: teamByJob.get(j.id) ?? [],
    }))
    setJobs(jobsWithDetails)
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role')
      .in('role', ['dev', 'master_technician', 'assistant', 'subcontractor', 'estimator'])
      .order('name')
    setUsers((data as UserRow[]) ?? [])
  }

  useEffect(() => {
    loadJobs()
    loadUsers()
  }, [authUser?.id])

  const filteredJobs = jobs.filter((j) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (j.hcp_number ?? '').toLowerCase().includes(q) ||
      (j.job_name ?? '').toLowerCase().includes(q) ||
      (j.job_address ?? '').toLowerCase().includes(q)
    )
  })

  function openNew() {
    setEditing(null)
    setHcpNumber('')
    setJobName('')
    setJobAddress('')
    setRevenue('')
    setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
    setTeamMemberIds([])
    setFormOpen(true)
  }

  function openEdit(job: JobWithDetails) {
    setEditing(job)
    setHcpNumber(job.hcp_number ?? '')
    setJobName(job.job_name ?? '')
    setJobAddress(job.job_address ?? '')
    setRevenue(job.revenue != null ? String(job.revenue) : '')
    setMaterials(
      job.materials.length > 0
        ? job.materials.map((m) => ({ id: m.id, description: m.description, amount: Number(m.amount) }))
        : [{ id: crypto.randomUUID(), description: '', amount: 0 }]
    )
    setTeamMemberIds(job.team_members.map((t) => t.user_id))
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function addMaterialRow() {
    setMaterials((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }])
  }

  function updateMaterialRow(id: string, updates: Partial<MaterialRow>) {
    setMaterials((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function removeMaterialRow(id: string) {
    setMaterials((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  async function saveJob() {
    if (!authUser?.id) return
    setSaving(true)
    setError(null)
    const revNum = revenue.trim() === '' ? null : parseFloat(revenue)
    const validMaterials = materials.filter((m) => (m.description ?? '').trim() !== '' || Number(m.amount) !== 0)
    try {
      if (editing) {
        await supabase
          .from('jobs_ledger')
          .update({ hcp_number: hcpNumber.trim(), job_name: jobName.trim(), job_address: jobAddress.trim(), revenue: revNum })
          .eq('id', editing.id)
        await supabase.from('jobs_ledger_materials').delete().eq('job_id', editing.id)
        for (const [i, m] of validMaterials.entries()) {
          await supabase.from('jobs_ledger_materials').insert({
            job_id: editing.id,
            description: m.description.trim(),
            amount: m.amount,
            sequence_order: i,
          })
        }
        const { data: existingTeam } = await supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', editing.id)
        const existingTeamIds = new Set((existingTeam ?? []).map((t: { user_id: string }) => t.user_id))
        const toAdd = teamMemberIds.filter((id) => !existingTeamIds.has(id))
        const toRemove = [...existingTeamIds].filter((id) => !teamMemberIds.includes(id))
        for (const uid of toAdd) {
          await supabase.from('jobs_ledger_team_members').insert({ job_id: editing.id, user_id: uid })
        }
        for (const uid of toRemove) {
          await supabase.from('jobs_ledger_team_members').delete().eq('job_id', editing.id).eq('user_id', uid)
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('jobs_ledger')
          .insert({
            master_user_id: authUser.id,
            hcp_number: hcpNumber.trim(),
            job_name: jobName.trim(),
            job_address: jobAddress.trim(),
            revenue: revNum,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        const jobId = inserted?.id
        if (jobId) {
          for (const [i, m] of validMaterials.entries()) {
            await supabase.from('jobs_ledger_materials').insert({
              job_id: jobId,
              description: m.description.trim(),
              amount: m.amount,
              sequence_order: i,
            })
          }
          for (const uid of teamMemberIds) {
            await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
          }
        }
      }
      closeForm()
      await loadJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteJob(id: string) {
    setDeletingId(id)
    const { error: err } = await supabase.from('jobs_ledger').delete().eq('id', id)
    if (err) setError(err.message)
    else await loadJobs()
    setDeletingId(null)
  }

  return (
    <div>
      <h1>Jobs</h1>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <button type="button" onClick={() => setActiveTab('ledger')} style={tabStyle(activeTab === 'ledger')}>
          Ledger
        </button>
        <button type="button" onClick={() => setActiveTab('upcoming')} style={tabStyle(activeTab === 'upcoming')}>
          Upcoming
        </button>
        <button type="button" onClick={() => setActiveTab('teams-summary')} style={tabStyle(activeTab === 'teams-summary')}>
          Teams Summary
        </button>
      </div>

      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={openNew}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              New Job
            </button>
            <input
              type="search"
              placeholder="Search jobs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 200px',
                minWidth: 200,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
              }}
            />
          </div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : filteredJobs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No jobs yet. Click New Job to add one.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP #</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job Address</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Materials List</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Team Members</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Revenue</th>
                    <th style={{ padding: '0.75rem', width: 100, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>{job.hcp_number || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{job.job_name || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{job.job_address || '—'}</td>
                      <td style={{ padding: '0.75rem', whiteSpace: 'pre-wrap', maxWidth: 200 }}>
                        {job.materials.length === 0
                          ? '—'
                          : job.materials
                              .filter((m) => (m.description ?? '').trim() || Number(m.amount) !== 0)
                              .map((m) => `${(m.description || '').trim() || 'Item'}: $${formatCurrency(Number(m.amount))}`)
                              .join('\n')}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {job.team_members.length === 0
                          ? '—'
                          : job.team_members.map((t) => t.users?.name ?? 'Unknown').join(', ')}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {job.revenue != null ? `$${formatCurrency(Number(job.revenue))}` : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => openEdit(job)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#e5e7eb',
                            color: '#374151',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteJob(job.id)}
                          disabled={deletingId === job.id}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#fee2e2',
                            color: '#991b1c',
                            border: 'none',
                            borderRadius: 4,
                            cursor: deletingId === job.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {deletingId === job.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'upcoming' && <p style={{ color: '#6b7280' }}>Upcoming content coming soon.</p>}
      {activeTab === 'teams-summary' && <p style={{ color: '#6b7280' }}>Teams Summary content coming soon.</p>}

      {formOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={(e) => e.target === e.currentTarget && closeForm()}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 560,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>{editing ? 'Edit Job' : 'New Job'}</h2>
            {error && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>HCP #</label>
                <input
                  type="text"
                  value={hcpNumber}
                  onChange={(e) => setHcpNumber(e.target.value)}
                  placeholder="HCP number"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Name</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="Job name"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Address</label>
                <input
                  type="text"
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                  placeholder="Address"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Materials List</label>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount ($)</th>
                        <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => updateMaterialRow(row.id, { description: e.target.value })}
                              placeholder="Item description"
                              style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.amount || ''}
                              onChange={(e) => updateMaterialRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                              placeholder="0"
                              style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => removeMaterialRow(row.id)}
                              disabled={materials.length <= 1}
                              style={{
                                padding: '0.25rem',
                                background: materials.length <= 1 ? '#f3f4f6' : '#fee2e2',
                                color: materials.length <= 1 ? '#9ca3af' : '#991b1c',
                                border: 'none',
                                borderRadius: 4,
                                cursor: materials.length <= 1 ? 'not-allowed' : 'pointer',
                                fontSize: '0.8125rem',
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addMaterialRow} style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                  Add line item
                </button>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Team Members</label>
                <select
                  multiple
                  value={teamMemberIds}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions, (o) => o.value)
                    setTeamMemberIds(opts)
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                    minHeight: 100,
                  }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Hold Ctrl/Cmd to select multiple.</p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Revenue ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={saveJob}
                disabled={saving || !jobName.trim() || !jobAddress.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={closeForm} style={{ padding: '0.5rem 1rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
