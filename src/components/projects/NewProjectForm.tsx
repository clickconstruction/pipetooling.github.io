import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Pencil, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { filterActiveCustomersForPicker } from '../../lib/customerArchive'
import type { Database } from '../../types/database'
import type { NewProjectPrefill } from '../../contexts/NewProjectModalContext'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type StepType = Database['public']['Enums']['step_type'] | null

type PreviewStep = {
  id: string
  template_step_id: string | null
  sequence_order: number
  name: string
  step_type: StepType
  required_skill: string | null
}
const PROJECT_STATUSES: ProjectRow['status'][] = ['awaiting_start', 'active', 'completed', 'on_hold']

function IconActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'danger'
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        fontSize: '0.75rem',
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        color: variant === 'danger' ? 'var(--text-red-700)' : 'inherit',
      }}
    >
      <Icon size={14} />
      {hovered && <span>{label}</span>}
    </button>
  )
}

export type NewProjectFormProps = {
  prefill?: NewProjectPrefill
  onCancel?: () => void
  onCreated?: (projectId: string) => void
}

export default function NewProjectForm({ prefill, onCancel, onCreated }: NewProjectFormProps) {
  const navigate = useNavigate()

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
  const [customersLoading, setCustomersLoading] = useState(true)
  const [previewSteps, setPreviewSteps] = useState<PreviewStep[]>([])
  const [previewStepsLoading, setPreviewStepsLoading] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editingStepName, setEditingStepName] = useState('')
  const [hasModifiedSteps, setHasModifiedSteps] = useState(false)

  const isNarrow = useIsNarrowScreen()

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, master_user_id, archived_at')
        .or('customer_type.is.null,customer_type.eq.commercial')
        .order('name')
      // New-project picker links a NEW record — archived customers excluded.
      setCustomers(filterActiveCustomersForPicker((data as CustomerRow[]) ?? []))
      setCustomersLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!prefill || customers.length === 0) return
    if (prefill.customerId && customers.some((c) => c.id === prefill.customerId)) {
      setCustomerId(prefill.customerId)
    }
    if (prefill.name != null) setName(prefill.name)
    if (prefill.address != null) setAddress(prefill.address)
    if (prefill.plansLink != null) setPlansLink(prefill.plansLink)
    if (prefill.hcp != null) setHousecallproNumber(prefill.hcp)
  }, [prefill, customers])

  function getCustomerDisplay(customer: CustomerRow): string {
    if (customer.address) {
      return `${customer.name} - ${customer.address}`
    }
    return customer.name
  }

  // Update customer search and auto-fill address when customerId changes
  // Also auto-set master_user_id from customer's master_user_id
  // Skip copying customer address when coming from "+ Add Project" on a job (`job` param) or when
  // `address` is present in the URL (including empty), so the job line is the only source for that flow.
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const selectedCustomer = customers.find((c) => c.id === customerId)
      if (selectedCustomer) {
        setCustomerSearch(getCustomerDisplay(selectedCustomer))
        const fromJobModal = Boolean(prefill?.fromJobModal)
        const addressExplicit = Boolean(prefill?.addressExplicit)
        if (!fromJobModal && !addressExplicit && !address.trim()) {
          setAddress(selectedCustomer.address ?? '')
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, customers, prefill?.fromJobModal, prefill?.addressExplicit])

  useEffect(() => {
    supabase.from('workflow_templates').select('id, name').order('name').then(({ data }) =>
      setTemplates((data as { id: string; name: string }[]) ?? [])
    )
  }, [])

  useEffect(() => {
    if (!templateId) {
      setPreviewSteps([])
      setPreviewStepsLoading(false)
      setEditingStepId(null)
      setEditingStepName('')
      setHasModifiedSteps(false)
      return
    }
    let cancelled = false
    setPreviewStepsLoading(true)
    supabase
      .from('workflow_template_steps')
      .select('id, sequence_order, name, step_type, required_skill')
      .eq('template_id', templateId)
      .order('sequence_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const steps: PreviewStep[] = (data ?? []).map((s: { id: string; sequence_order: number; name: string; step_type: StepType; required_skill: string | null }) => ({
          id: s.id,
          template_step_id: s.id,
          sequence_order: s.sequence_order,
          name: s.name,
          step_type: s.step_type,
          required_skill: s.required_skill,
        }))
        setPreviewSteps(steps)
        setHasModifiedSteps(false)
        setPreviewStepsLoading(false)
      })
    return () => { cancelled = true }
  }, [templateId])

  function startEditStep(step: PreviewStep) {
    setEditingStepId(step.id)
    setEditingStepName(step.name)
  }

  function cancelEditStep() {
    setEditingStepId(null)
    setEditingStepName('')
  }

  function saveEditStep(stepId: string) {
    if (!editingStepName.trim()) return
    setPreviewSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, name: editingStepName.trim() } : s))
    )
    setHasModifiedSteps(true)
    cancelEditStep()
  }

  function moveStepUp(index: number) {
    if (index <= 0) return
    setPreviewSteps((prev) => {
      const a = prev[index - 1]
      const b = prev[index]
      if (!a || !b) return prev
      const next = [...prev]
      next[index - 1] = { ...b, sequence_order: index - 1 }
      next[index] = { ...a, sequence_order: index }
      return next
    })
    setHasModifiedSteps(true)
  }

  function moveStepDown(index: number) {
    if (index >= previewSteps.length - 1) return
    setPreviewSteps((prev) => {
      const a = prev[index]
      const b = prev[index + 1]
      if (!a || !b) return prev
      const next = [...prev]
      next[index] = { ...b, sequence_order: index }
      next[index + 1] = { ...a, sequence_order: index + 1 }
      return next
    })
    setHasModifiedSteps(true)
  }

  function removeStep(stepId: string) {
    setPreviewSteps((prev) =>
      prev.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, sequence_order: i }))
    )
    setHasModifiedSteps(true)
    if (editingStepId === stepId) cancelEditStep()
  }

  function addStep() {
    const maxOrder = previewSteps.length === 0 ? 0 : Math.max(...previewSteps.map((s) => s.sequence_order))
    const newId = crypto.randomUUID()
    const newStep: PreviewStep = {
      id: newId,
      template_step_id: null,
      sequence_order: maxOrder + 1,
      name: 'New step',
      step_type: null,
      required_skill: null,
    }
    setPreviewSteps((prev) => [...prev, newStep])
    setHasModifiedSteps(true)
    setEditingStepId(newId)
    setEditingStepName('New step')
  }

  async function resetToTemplate() {
    if (!templateId) return
    setPreviewStepsLoading(true)
    const { data } = await supabase
      .from('workflow_template_steps')
      .select('id, sequence_order, name, step_type, required_skill')
      .eq('template_id', templateId)
      .order('sequence_order', { ascending: true })
    const steps: PreviewStep[] = (data ?? []).map((s: { id: string; sequence_order: number; name: string; step_type: StepType; required_skill: string | null }) => ({
      id: s.id,
      template_step_id: s.id,
      sequence_order: s.sequence_order,
      name: s.name,
      step_type: s.step_type,
      required_skill: s.required_skill,
    }))
    setPreviewSteps(steps)
    setHasModifiedSteps(false)
    setPreviewStepsLoading(false)
    cancelEditStep()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!customerId) {
      setError('Please select a customer.')
      return
    }
    const jobId = prefill?.linkJobId ?? null
    setLoading(true)

    let projectMasterId: string | null = null
    if (customerId && customers.length > 0) {
      const selectedCustomer = customers.find((c) => c.id === customerId)
      projectMasterId = selectedCustomer?.master_user_id || null
    }

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
      master_user_id: projectMasterId,
    }

    const { data: inserted, error: err } = await supabase.from('projects').insert(payload).select('id').single()
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    const newId = (inserted as { id: string }).id

    const afterCreateNavigate = () => {
      onCreated?.(newId)
    }

    if (templateId) {
      const wfName = `${name.trim()} workflow`
      const { data: wf, error: wfErr } = await supabase.from('project_workflows').insert({ project_id: newId, template_id: templateId, name: wfName }).select('id').single()
      if (wfErr) {
        setError(wfErr.message)
        setLoading(false)
        return
      }
      const wfId = (wf as { id: string }).id
      if (previewSteps.length > 0) {
        for (const s of previewSteps) {
          const { error: stepErr } = await supabase.from('project_workflow_steps').insert({
            workflow_id: wfId,
            template_step_id: s.template_step_id,
            sequence_order: s.sequence_order,
            name: s.name,
            step_type: s.step_type,
            assigned_skill: s.required_skill,
            status: 'pending',
          })
          if (stepErr) {
            setError(stepErr.message)
            setLoading(false)
            return
          }
        }
      }
      if (jobId) {
        const { error: jobErr } = await supabase.from('jobs_ledger').update({ project_id: newId }).eq('id', jobId)
        if (jobErr) {
          setError(jobErr.message)
          setLoading(false)
          return
        }
        afterCreateNavigate()
        navigate(`/jobs?edit=${jobId}&tab=stages`, { replace: true })
        setLoading(false)
        return
      }
      afterCreateNavigate()
      navigate(`/workflows/${newId}`, { replace: true })
      setLoading(false)
      return
    }
    if (previewSteps.length > 0) {
      const wfName = `${name.trim()} workflow`
      const { data: wf, error: wfErr } = await supabase.from('project_workflows').insert({ project_id: newId, template_id: null, name: wfName }).select('id').single()
      if (wfErr) {
        setError(wfErr.message)
        setLoading(false)
        return
      }
      const wfId = (wf as { id: string }).id
      for (const s of previewSteps) {
        const { error: stepErr } = await supabase.from('project_workflow_steps').insert({
          workflow_id: wfId,
          template_step_id: s.template_step_id,
          sequence_order: s.sequence_order,
          name: s.name,
          step_type: s.step_type,
          assigned_skill: s.required_skill,
          status: 'pending',
        })
        if (stepErr) {
          setError(stepErr.message)
          setLoading(false)
          return
        }
      }
      if (jobId) {
        const { error: jobErr } = await supabase.from('jobs_ledger').update({ project_id: newId }).eq('id', jobId)
        if (jobErr) {
          setError(jobErr.message)
          setLoading(false)
          return
        }
        afterCreateNavigate()
        navigate(`/jobs?edit=${jobId}&tab=stages`, { replace: true })
        setLoading(false)
        return
      }
      afterCreateNavigate()
      navigate(`/workflows/${newId}`, { replace: true })
      setLoading(false)
      return
    }
    if (jobId) {
      const { error: jobErr } = await supabase.from('jobs_ledger').update({ project_id: newId }).eq('id', jobId)
      if (jobErr) {
        setError(jobErr.message)
        setLoading(false)
        return
      }
      afterCreateNavigate()
      navigate(`/jobs?edit=${jobId}&tab=stages`, { replace: true })
      setLoading(false)
      return
    }
    afterCreateNavigate()
    navigate('/projects', { replace: true })
    setLoading(false)
  }

  if (customersLoading) return <p>Loading…</p>

  const missingFields: string[] = []
  if (!customerId) missingFields.push('Customer')
  if (!name.trim()) missingFields.push('Project Name')
  const canSubmit = missingFields.length === 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexDirection: isNarrow ? 'column' : 'row',
          gap: isNarrow ? '1.5rem' : '2rem',
          alignItems: 'flex-start',
        }}
      >
        <form onSubmit={handleSubmit} style={{ maxWidth: 400, flexShrink: 0 }}>
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <label htmlFor="customer" style={{ display: 'block', marginBottom: 4 }}>Customer *</label>
          <>
            <input
              id="customer"
              type="text"
              value={customerSearch}
              onChange={(e) => {
                const value = e.target.value
                setCustomerSearch(value)
                setCustomerDropdownOpen(true)
                if (customerId) {
                  const selectedCustomer = customers.find((c) => c.id === customerId)
                  if (!selectedCustomer || !value || getCustomerDisplay(selectedCustomer).toLowerCase() !== value.toLowerCase()) {
                    setCustomerId('')
                  }
                }
              }}
              onFocus={() => setCustomerDropdownOpen(true)}
              onBlur={() => {
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
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  maxHeight: 200,
                  overflowY: 'auto',
                  zIndex: 200,
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
                        if (!prefill?.fromJobModal && !prefill?.addressExplicit) {
                          setAddress(c.address ?? '')
                        }
                        setCustomerDropdownOpen(false)
                      }}
                      style={{
                        padding: '0.5rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-muted)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface)'
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.address && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.address}</div>}
                    </div>
                  ))}
                {customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                  <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No customers found</div>
                )}
              </div>
            )}
          </>
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
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>[Street / Town+Building] + [Remodel / New Build / Re-Pipe]</div>
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
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
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
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
          )}
          {onCancel ? (
            <button type="button" onClick={onCancel} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>
              Cancel
            </button>
          ) : (
            <Link to="/projects" style={{ padding: '0.5rem 1rem' }}>Cancel</Link>
          )}
        </div>
      </form>

        {templates.length > 0 && (
          <div
            style={{
              flex: isNarrow ? undefined : 1,
              minWidth: 280,
              width: isNarrow ? '100%' : undefined,
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-page)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>Workflow</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="template" style={{ display: 'block', marginBottom: 4 }}>Start workflow from template:</label>
              <select
                id="template"
                value={hasModifiedSteps && templateId ? '__custom__' : templateId}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__custom__') return
                  setTemplateId(v)
                  setHasModifiedSteps(false)
                }}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="">No template (start with empty workflow)</option>
                {hasModifiedSteps && templateId && (
                  <option value="__custom__">Custom (from {templates.find((t) => t.id === templateId)?.name ?? 'template'})</option>
                )}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {hasModifiedSteps && templateId && !previewStepsLoading && (
                  <button type="button" onClick={resetToTemplate} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                    Reset to template
                  </button>
                )}
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Optional. The template&apos;s steps will be copied into the new project&apos;s workflow.</span>
              </div>
            </div>
            {previewStepsLoading ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading...</p>
            ) : previewSteps.length === 0 ? (
              <>
                <p style={{ color: 'var(--text-muted)', margin: 0, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  {!templateId ? 'Build your workflow from scratch. Add steps below.' : 'No steps. Add steps below.'}
                </p>
                <button type="button" onClick={addStep} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                  + Add step
                </button>
              </>
            ) : (
              <>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
                  {previewSteps.map((s, i) => (
                    <li key={s.id} style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      {editingStepId === s.id ? (
                        <>
                          <input
                            type="text"
                            value={editingStepName}
                            onChange={(e) => setEditingStepName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditStep(s.id)
                              if (e.key === 'Escape') cancelEditStep()
                            }}
                            style={{ flex: 1, padding: '0.35rem', fontSize: '0.875rem' }}
                            autoFocus
                          />
                          <button type="button" onClick={() => saveEditStep(s.id)} disabled={!editingStepName.trim()} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>
                            Save
                          </button>
                          <button type="button" onClick={cancelEditStep} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{s.name}</span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <IconActionButton icon={Pencil} label="Edit" onClick={() => startEditStep(s)} />
                            <IconActionButton icon={ChevronUp} label="Move up" onClick={() => moveStepUp(i)} disabled={i === 0} />
                            <IconActionButton icon={ChevronDown} label="Move down" onClick={() => moveStepDown(i)} disabled={i === previewSteps.length - 1} />
                            <IconActionButton icon={Trash2} label="Remove" onClick={() => removeStep(s.id)} variant="danger" />
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={addStep} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                  + Add step
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
