import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']

const PROJECT_STATUSES: ProjectRow['status'][] = ['active', 'completed', 'on_hold']

export default function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('customers').select('id, name').order('name')
      setCustomers((data as CustomerRow[]) ?? [])
      setCustomersLoading(false)
    })()
  }, [])

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
    setLoading(true)
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      housecallpro_number: housecallproNumber.trim() || null,
      plans_link: plansLink.trim() || null,
      status,
      customer_id: customerId,
    }
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
              step_type: ts.step_type,
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
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="customer" style={{ display: 'block', marginBottom: 4 }}>Customer *</label>
          <select
            id="customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            disabled={!isNew}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!isNew && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>Customer cannot be changed when editing.</div>}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
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

      {!isNew && (
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
