import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
  const isNew = !id

  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [housecallproNumber, setHousecallproNumber] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [status, setStatus] = useState<ProjectRow['status']>('active')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(!isNew)
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
      const { data } = await supabase.from('customers').select('id, name, address, master_user_id').order('name')
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

  // Update customer search and auto-fill address when customerId changes
  // Also auto-set master_user_id from customer's master_user_id
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const selectedCustomer = customers.find((c) => c.id === customerId)
      if (selectedCustomer) {
        setCustomerSearch(getCustomerDisplay(selectedCustomer))
        // Auto-fill address from customer (only in new mode, or if address is currently empty)
        if (isNew || !address.trim()) {
          setAddress(selectedCustomer.address ?? '')
        }
        // Project owner automatically matches customer owner - no need to set state, will use in submit
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, customers, isNew])

  useEffect(() => {
    if (isNew) {
      supabase.from('workflow_templates').select('id, name').order('name').then(({ data }) =>
        setTemplates((data as { id: string; name: string }[]) ?? [])
      )
    }
  }, [isNew])


  useEffect(() => {
    if (!isNew && id) {
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
    }
  }, [isNew, id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (isNew && !customerId) {
      setError('Please select a customer.')
      return
    }
    setLoading(true)
    
    // Project owner automatically matches customer owner
    let projectMasterId: string | null = null
    if (customerId && customers.length > 0) {
      const selectedCustomer = customers.find(c => c.id === customerId)
      projectMasterId = selectedCustomer?.master_user_id || null
    }
    
    // For editing: don't update master_user_id, keep it as-is (it should match customer)
    const payload: {
      name: string
      address: string | null
      description: string | null
      housecallpro_number: string | null
      plans_link: string | null
      status: ProjectRow['status']
      customer_id: string
      master_user_id?: string | null
    } = {
      name: name.trim(),
      address: address.trim() || null,
      description: description.trim() || null,
      housecallpro_number: housecallproNumber.trim() || null,
      plans_link: plansLink.trim() || null,
      status,
      customer_id: customerId,
    }
    
    // Only set master_user_id for new projects (it matches customer owner)
    if (isNew) {
      payload.master_user_id = projectMasterId
    }
    // For updates, don't include master_user_id - it should remain tied to the customer
    if (isNew) {
      const { data: inserted, error: err } = await supabase.from('projects').insert(payload).select('id').single()
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const newId = (inserted as { id: string }).id
      if (templateId) {
        const wfName = `${name.trim()} workflow`
        const { data: wf, error: wfErr } = await supabase.from('project_workflows').insert({ project_id: newId, template_id: templateId, name: wfName }).select('id').single()
        if (wfErr) {
          setError(wfErr.message)
          setLoading(false)
          return
        }
        const wfId = (wf as { id: string }).id
        const { data: tSteps } = await supabase.from('workflow_template_steps').select('id, sequence_order, name, step_type, required_skill').eq('template_id', templateId).order('sequence_order', { ascending: true })
        if (tSteps && tSteps.length > 0) {
          for (const ts of tSteps as { id: string; sequence_order: number; name: string; step_type: string | null; required_skill: string | null }[]) {
            const { error: stepErr } = await supabase.from('project_workflow_steps').insert({
              workflow_id: wfId,
              template_step_id: ts.id,
              sequence_order: ts.sequence_order,
              name: ts.name,
              step_type: (ts.step_type ?? null) as 'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null,
              assigned_skill: ts.required_skill,
              status: 'pending',
            })
            if (stepErr) {
              setError(stepErr.message)
              setLoading(false)
              return
            }
          }
        }
        navigate(`/workflows/${newId}`, { replace: true })
      } else {
        navigate('/projects', { replace: true })
      }
    } else {
      const { error: err } = await supabase.from('projects').update(payload).eq('id', id!)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      navigate('/projects', { replace: true })
    }
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
    const { data: wfs } = await supabase.from('project_workflows').select('id').eq('project_id', id)
    const wfIds = (wfs as { id: string }[] || []).map((w) => w.id)
    if (wfIds.length > 0) {
      const { data: steps } = await supabase.from('project_workflow_steps').select('id').in('workflow_id', wfIds)
      const stepIds = (steps as { id: string }[] || []).map((s) => s.id)
      for (const sid of stepIds) {
        await supabase.from('workflow_step_dependencies').delete().eq('step_id', sid)
        await supabase.from('workflow_step_dependencies').delete().eq('depends_on_step_id', sid)
      }
      await supabase.from('project_workflow_steps').delete().in('workflow_id', wfIds)
    }
    await supabase.from('project_workflows').delete().eq('project_id', id)
    const { error: delErr } = await supabase.from('projects').delete().eq('id', id)
    setDeleting(false)
    if (delErr) {
      setError(delErr.message)
      return
    }
    closeDelete()
    navigate('/projects', { replace: true })
  }

  if (customersLoading) return <p>Loading…</p>
  if (!isNew && fetching) return <p>Loading…</p>

  return (
    <div>
      <h1 style={{ marginBottom: '1rem' }}>{isNew ? 'New project' : 'Edit project'}</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <label htmlFor="customer" style={{ display: 'block', marginBottom: 4 }}>Customer *</label>
          {!isNew ? (
            <>
              <input
                id="customer"
                type="text"
                value={customerSearch}
                disabled
                style={{ width: '100%', padding: '0.5rem', background: '#f3f4f6' }}
              />
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>Customer cannot be changed when editing.</div>
            </>
          ) : (
            <>
              <input
                id="customer"
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  const value = e.target.value
                  setCustomerSearch(value)
                  setCustomerDropdownOpen(true)
                  // Clear customerId if search doesn't match the currently selected customer
                  if (customerId) {
                    const selectedCustomer = customers.find((c) => c.id === customerId)
                    if (!selectedCustomer || !value || getCustomerDisplay(selectedCustomer).toLowerCase() !== value.toLowerCase()) {
                      setCustomerId('')
                    }
                  }
                }}
                onFocus={() => setCustomerDropdownOpen(true)}
                onBlur={() => {
                  // Delay closing to allow click on dropdown item
                  setTimeout(() => setCustomerDropdownOpen(false), 200)
                }}
                placeholder="Search customers..."
                required
                style={{ width: '100%', padding: '0.5rem' }}
              />
              {customerDropdownOpen && customers.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 4,
                    maxHeight: 200,
                    overflowY: 'auto',
                    zIndex: 100,
                    marginTop: 2,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {customers
                    .filter((c) => {
                      const searchLower = customerSearch.toLowerCase()
                      const nameLower = c.name.toLowerCase()
                      const addressLower = (c.address || '').toLowerCase()
                      return nameLower.includes(searchLower) || addressLower.includes(searchLower)
                    })
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id)
                          setCustomerSearch(getCustomerDisplay(c))
                          // Auto-fill address from customer (only in new mode, or if address is empty)
                          if (isNew || !address) {
                            setAddress(c.address ?? '')
                          }
                          setCustomerDropdownOpen(false)
                        }}
                        style={{
                          padding: '0.5rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white'
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        {c.address && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                      </div>
                    ))}
                  {customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>No customers found</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="address" style={{ display: 'block', marginBottom: 4 }}>Address</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: 4 }}>Project Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>[Street / Town+Building] + [Remodel / New Build / Re-Pipe]</div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="description" style={{ display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="housecallpro-number" style={{ display: 'block', marginBottom: 4 }}>HouseCallPro #</label>
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
          <label htmlFor="plans-link" style={{ display: 'block', marginBottom: 4 }}>Link to plans</label>
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
          <label htmlFor="status" style={{ display: 'block', marginBottom: 4 }}>Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectRow['status'])}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {isNew && templates.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="template" style={{ display: 'block', marginBottom: 4 }}>Add workflow from template</label>
            <select
              id="template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="">No template (start with empty workflow)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>Optional. The template&apos;s steps will be copied into the new project&apos;s workflow.</div>
          </div>
        )}
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Saving…' : 'Save'}
          </button>
          <Link to="/projects" style={{ padding: '0.5rem 1rem' }}>Cancel</Link>
        </div>
      </form>

      {!isNew && (myRole === 'dev' || myRole === 'master_technician') && (
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb', maxWidth: 400 }}>
          <button type="button" onClick={openDelete} style={{ padding: '0.5rem 1rem', color: '#b91c1c' }}>
            Delete project
          </button>
        </div>
      )}

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete project</h2>
            <p style={{ marginBottom: '1rem' }}>Type the project name <strong>{name}</strong> to confirm.</p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setError(null) }}
              placeholder="Project name"
              disabled={deleting}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              autoComplete="off"
            />
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleDelete} disabled={deleting || deleteConfirm.trim() !== name.trim()} style={{ color: '#b91c1c' }}>
                {deleting ? 'Deleting…' : 'Delete project'}
              </button>
              <button type="button" onClick={closeDelete} disabled={deleting}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
