import { useEffect, useState } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor'

const PROJECT_STATUSES: ProjectRow['status'][] = ['awaiting_start', 'active', 'completed', 'on_hold']

export default function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: authUser } = useAuth()

  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [housecallproNumber, setHousecallproNumber] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [status, setStatus] = useState<ProjectRow['status']>('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [customersLoading, setCustomersLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [myRole, setMyRole] = useState<UserRole | null>(null)

  useEffect(() => {
    if (!authUser?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()
      .then(({ data }) => setMyRole((data as { role: UserRole } | null)?.role ?? null))
  }, [authUser?.id])

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, master_user_id')
        .or('customer_type.is.null,customer_type.eq.commercial')
        .order('name')
      setCustomers((data as CustomerRow[]) ?? [])
      setCustomersLoading(false)
    })()
  }, [])

  function getCustomerDisplay(customer: CustomerRow): string {
    if (customer.address) {
      return `${customer.name} - ${customer.address}`
    }
    return customer.name
  }

  useEffect(() => {
    if (customerId && customers.length > 0) {
      const selectedCustomer = customers.find((c) => c.id === customerId)
      if (selectedCustomer) {
        setCustomerSearch(getCustomerDisplay(selectedCustomer))
      }
    }
  }, [customerId, customers])

  useEffect(() => {
    if (!id) {
      setFetching(false)
      return
    }
    (async () => {
      const { data, error: err } = await supabase.from('projects').select('*').eq('id', id).single()
      if (err) {
        setError(err.message)
        setFetching(false)
        return
      }
      const row = data as ProjectRow
      setName(row.name)
      setAddress(row.address ?? '')
      setDescription(row.description ?? '')
      setHousecallproNumber(row.housecallpro_number ?? '')
      setPlansLink(row.plans_link ?? '')
      setStatus(row.status)
      setCustomerId(row.customer_id)
      setFetching(false)
    })()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!id) return
    setLoading(true)

    const payload: {
      name: string
      address: string | null
      description: string | null
      housecallpro_number: string | null
      plans_link: string | null
      status: ProjectRow['status']
      customer_id: string
    } = {
      name: name.trim(),
      address: address.trim() || null,
      description: description.trim() || null,
      housecallpro_number: housecallproNumber.trim() || null,
      plans_link: plansLink.trim() || null,
      status,
      customer_id: customerId,
    }

    const { error: err } = await supabase.from('projects').update(payload).eq('id', id)
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    navigate('/projects', { replace: true })
    setLoading(false)
  }

  function openDelete() {
    setDeleteOpen(true)
    setDeleteConfirm('')
    setError(null)
  }

  function closeDelete() {
    setDeleteOpen(false)
  }

  async function handleDelete() {
    if (!id || deleteConfirm.trim() !== name.trim()) return
    setDeleting(true)
    setError(null)

    try {
      const { data: wfs, error: wfsError } = await supabase.from('project_workflows').select('id').eq('project_id', id)

      if (wfsError) {
        throw new Error(`Failed to load workflows: ${wfsError.message}`)
      }

      const wfIds = ((wfs as { id: string }[]) || []).map((w) => w.id)

      if (wfIds.length > 0) {
        const { data: steps, error: stepsError } = await supabase.from('project_workflow_steps').select('id').in('workflow_id', wfIds)

        if (stepsError) {
          throw new Error(`Failed to load workflow steps: ${stepsError.message}`)
        }

        const stepIds = ((steps as { id: string }[]) || []).map((s) => s.id)

        for (const sid of stepIds) {
          const { error: depError1 } = await supabase.from('workflow_step_dependencies').delete().eq('step_id', sid)

          if (depError1) {
            throw new Error(`Failed to delete step dependencies: ${depError1.message}`)
          }

          const { error: depError2 } = await supabase.from('workflow_step_dependencies').delete().eq('depends_on_step_id', sid)

          if (depError2) {
            throw new Error(`Failed to delete reverse dependencies: ${depError2.message}`)
          }
        }

        const { error: stepsDelError } = await supabase.from('project_workflow_steps').delete().in('workflow_id', wfIds)

        if (stepsDelError) {
          throw new Error(`Failed to delete workflow steps: ${stepsDelError.message}`)
        }
      }

      const { error: wfsDelError } = await supabase.from('project_workflows').delete().eq('project_id', id)

      if (wfsDelError) {
        throw new Error(`Failed to delete workflows: ${wfsDelError.message}`)
      }

      const { error: delErr } = await supabase.from('projects').delete().eq('id', id)

      if (delErr) {
        throw new Error(`Failed to delete project: ${delErr.message}`)
      }

      closeDelete()
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  if (!id) {
    return <Navigate to="/projects" replace />
  }

  if (customersLoading) return <p>Loading…</p>
  if (fetching) return <p>Loading…</p>

  const missingFields: string[] = []
  if (!name.trim()) missingFields.push('Project Name')
  const canSubmit = missingFields.length === 0

  return (
    <div>
      <h1 style={{ marginBottom: '1rem' }}>Edit project</h1>
      <div style={{ maxWidth: 400 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="customer" style={{ display: 'block', marginBottom: 4 }}>
              Customer *
            </label>
            <input
              id="customer"
              type="text"
              value={customerSearch}
              disabled
              style={{ width: '100%', padding: '0.5rem', background: '#f3f4f6' }}
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>Customer cannot be changed when editing.</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="address" style={{ display: 'block', marginBottom: 4 }}>
              Address
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="name" style={{ display: 'block', marginBottom: 4 }}>
              Project Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>
              [Street / Town+Building] + [Remodel / New Build / Re-Pipe]
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="description" style={{ display: 'block', marginBottom: 4 }}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="housecallpro-number" style={{ display: 'block', marginBottom: 4 }}>
              HouseCallPro #
            </label>
            <input
              id="housecallpro-number"
              type="text"
              value={housecallproNumber}
              onChange={(e) => setHousecallproNumber(e.target.value)}
              placeholder="#777"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="plans-link" style={{ display: 'block', marginBottom: 4 }}>
              Link to plans
            </label>
            <input
              id="plans-link"
              type="url"
              value={plansLink}
              onChange={(e) => setPlansLink(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="status" style={{ display: 'block', marginBottom: 4 }}>
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectRow['status'])}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined}
              style={{ padding: '0.5rem 1rem' }}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            {!canSubmit && !loading && missingFields.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {missingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>
                    {f}
                  </span>
                ))}
              </span>
            )}
            <Link to="/projects" style={{ padding: '0.5rem 1rem' }}>
              Cancel
            </Link>
          </div>
        </form>

        {(myRole === 'dev' || myRole === 'master_technician') && (
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button type="button" onClick={openDelete} style={{ padding: '0.5rem 1rem', color: '#b91c1c' }}>
              Delete project
            </button>
          </div>
        )}

        {deleteOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
              <h2 style={{ marginTop: 0 }}>Delete project</h2>
              <p style={{ marginBottom: '1rem' }}>
                Type the project name <strong>{name}</strong> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => {
                  setDeleteConfirm(e.target.value)
                  setError(null)
                }}
                placeholder="Project name"
                disabled={deleting}
                style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                autoComplete="off"
              />
              {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirm.trim() !== name.trim()}
                  style={{ color: '#b91c1c' }}
                >
                  {deleting ? 'Deleting…' : 'Delete project'}
                </button>
                <button type="button" onClick={closeDelete} disabled={deleting}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
